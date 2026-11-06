import { createHmac } from "node:crypto";
import https from "node:https";
import { UnrecoverableError, type Job } from "bullmq";
import type { DeliveryQueueJobData } from "../queue/delivery-queue";
import type { DeliveryContext, PersistAttemptInput } from "./delivery-repository";
import { decryptEndpointSecret } from "../utils/endpoint-secret";
import {
  createPinnedHttpsAgent,
  validateWebhookUrl,
  WebhookUrlError,
  type ValidatedWebhookTarget
} from "./webhook-url";

const MAX_RESPONSE_BODY_BYTES = 10 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;

export interface DeliveryRepository {
  findContext(eventId: string, endpointId: string, projectId: string): Promise<DeliveryContext>;
  isEndpointDeliverable(endpointId: string, projectId: string): Promise<boolean>;
  markProcessing(eventId: string, projectId: string): Promise<void>;
  persistAttempt(input: PersistAttemptInput): Promise<void>;
  beginReplayTarget?(replayRequestId: string, eventId: string, endpointId: string): Promise<boolean>;
}

export interface HttpDeliveryResult {
  statusCode: number;
  responseBody: string;
}

export type WebhookSender = (
  target: ValidatedWebhookTarget,
  body: string,
  headers: Record<string, string>,
  timeoutMs: number
) => Promise<HttpDeliveryResult>;

interface DeliveryJobLike {
  data: DeliveryQueueJobData;
  attemptsMade: number;
  opts: { attempts?: number };
}

export interface DeliverWebhookOptions {
  repository: DeliveryRepository;
  requestTimeoutMs?: number;
  validateTarget?: typeof validateWebhookUrl;
  send?: WebhookSender;
  now?: () => Date;
}

export function createWebhookSignature(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

export function sendWebhookRequest(
  target: ValidatedWebhookTarget,
  body: string,
  headers: Record<string, string>,
  timeoutMs: number
): Promise<HttpDeliveryResult> {
  const agent = createPinnedHttpsAgent(target);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let responseBytes = 0;
    let settled = false;
    let request: ReturnType<typeof https.request> | undefined;
    const finish = (error?: Error, result?: HttpDeliveryResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      agent.destroy();
      if (error) reject(error);
      else if (result) resolve(result);
      else reject(new Error("Webhook request failed."));
    };

    const timer = setTimeout(() => {
      request?.destroy(new Error("Webhook request timed out."));
    }, timeoutMs);

    try {
      request = https.request(target.url, {
        method: "POST",
        agent,
        headers: {
          ...headers,
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body).toString()
        }
      }, (incomingResponse) => {
        incomingResponse.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          const remaining = MAX_RESPONSE_BODY_BYTES - responseBytes;
          if (remaining > 0) {
            const retained = buffer.subarray(0, remaining);
            chunks.push(retained);
            responseBytes += retained.length;
          }
        });
        incomingResponse.on("error", () => finish(new Error("Webhook response failed.")));
        incomingResponse.on("end", () => finish(undefined, {
          statusCode: incomingResponse.statusCode ?? 0,
          responseBody: Buffer.concat(chunks).toString("utf8")
        }));
      });
    } catch {
      finish(new Error("Webhook request failed."));
      return;
    }

    request.on("error", () => finish(new Error("Webhook request failed.")));
    request.end(body);
  });
}

function isSuccessStatus(statusCode: number): boolean {
  return statusCode >= 200 && statusCode < 300;
}

function retryLimit(job: DeliveryJobLike): number {
  return Number.isSafeInteger(job.opts.attempts) && (job.opts.attempts ?? 0) > 0
    ? job.opts.attempts!
    : 1;
}

export async function deliverWebhookJob(
  job: DeliveryJobLike | Job<DeliveryQueueJobData>,
  options: DeliverWebhookOptions
): Promise<void> {
  const startedAt = Date.now();
  const { eventId, endpointId, projectId } = job.data;
  const replayRequestId = "replayRequestId" in job.data ? job.data.replayRequestId : undefined;
  const maxAttempts = retryLimit(job);
  const terminalAttempt = job.attemptsMade + 1 >= maxAttempts;
  const now = options.now ?? (() => new Date());
  const persist = async (
    status: PersistAttemptInput["status"],
    values: Partial<Pick<PersistAttemptInput, "responseStatusCode" | "responseBody" | "errorMessage">>
  ): Promise<void> => {
    await options.repository.persistAttempt({
      eventId,
      projectId,
      endpointId,
      replayRequestId,
      status,
      responseStatusCode: values.responseStatusCode ?? null,
      responseBody: values.responseBody ?? null,
      errorMessage: values.errorMessage ?? null,
      durationMs: Math.max(0, Date.now() - startedAt),
      attemptedAt: now()
    });
  };

  if (replayRequestId) {
    if (!options.repository.beginReplayTarget) {
      throw new Error("Replay delivery repository is not configured.");
    }
    const shouldDeliver = await options.repository.beginReplayTarget(replayRequestId, eventId, endpointId);
    if (!shouldDeliver) return;
  }

  const context = await options.repository.findContext(eventId, endpointId, projectId);
  if (!context.event || !context.endpoint) {
    throw new UnrecoverableError("Webhook event or endpoint no longer exists.");
  }

  if (!context.endpoint.isActive || context.endpoint.deletedAt !== null) {
    await persist("skipped", { errorMessage: "Endpoint is inactive or deleted." });
    return;
  }

  if (!replayRequestId) await options.repository.markProcessing(eventId, projectId);

  let result: HttpDeliveryResult;
  try {
    const target = await (options.validateTarget ?? validateWebhookUrl)(context.endpoint.url);
    if (!await options.repository.isEndpointDeliverable(endpointId, projectId)) {
      await persist("skipped", { errorMessage: "Endpoint is inactive or deleted." });
      return;
    }

    const secret = decryptEndpointSecret(context.endpoint.encryptedSecret);
    const body = JSON.stringify(context.event.payload);
    const headers = {
      "user-agent": "Relay-Webhook/1.0",
      "x-relay-event-id": eventId,
      "x-relay-event-type": context.event.eventType,
      "x-relay-signature": createWebhookSignature(secret, body)
    };
    result = await (options.send ?? sendWebhookRequest)(
      target,
      body,
      headers,
      options.requestTimeoutMs ?? DEFAULT_TIMEOUT_MS
    );
    } catch (error) {
    if (error instanceof UnrecoverableError) {
      throw error;
    }

    // Permanent URL validation errors should never be retried.
    if (error instanceof WebhookUrlError && error.type === "permanent") {
      await persist("failed", { errorMessage: error.message });
      throw new UnrecoverableError(error.message);
    }

    // Temporary failures can be retried by BullMQ.
    const errorMessage =
      "Webhook request failed or destination validation was rejected.";

    await persist(terminalAttempt ? "failed" : "retrying", {
      errorMessage
    });

    if (terminalAttempt) {
      throw new UnrecoverableError(errorMessage);
    }

    throw new Error(errorMessage);
  }

  if (!isSuccessStatus(result.statusCode)) {
    const errorMessage = `Webhook endpoint returned HTTP ${result.statusCode}.`;
    await persist(terminalAttempt ? "failed" : "retrying", {
      responseStatusCode: result.statusCode,
      responseBody: result.responseBody,
      errorMessage
    });
    if (terminalAttempt) throw new UnrecoverableError(errorMessage);
    throw new Error(errorMessage);
  }

  await persist("delivered", {
    responseStatusCode: result.statusCode,
    responseBody: result.responseBody
  });
}
