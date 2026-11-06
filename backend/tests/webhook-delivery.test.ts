import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptEndpointSecret } from "../src/utils/endpoint-secret";
import {
  createWebhookSignature,
  deliverWebhookJob,
  type DeliveryRepository
} from "../src/services/webhook-delivery";
import type { DeliveryJobData, ReplayDeliveryJobData } from "../src/queue/delivery-queue";
import {
  WebhookUrlError,
  type ValidatedWebhookTarget
} from "../src/services/webhook-url";


const signingSecret = "unit-test-signing-secret";
const trustedUrl = "https://customer.example.org/webhooks/relay";
const target: ValidatedWebhookTarget = {
  url: trustedUrl,
  hostname: "customer.example.org",
  addresses: [{ address: "8.8.8.8", family: 4 }]
};
const jobData: DeliveryJobData = {
  outboxMessageId: "outbox-id",
  eventId: "event-id",
  projectId: "project-id",
  endpointId: "endpoint-id",
  endpointUrl: "https://attacker.example.org/queued-url-is-untrusted",
  eventType: "invoice.created",
  payload: { invoiceId: "invoice-id" }
};

function createHarness(overrides: {
  endpoint?: Partial<NonNullable<Awaited<ReturnType<DeliveryRepository["findContext"]>>["endpoint"]>>;
  isDeliverable?: boolean;
} = {}) {
  const context = {
    endpoint: {
      id: jobData.endpointId,
      projectId: jobData.projectId,
      url: trustedUrl,
      encryptedSecret: encryptEndpointSecret(signingSecret),
      isActive: true,
      deletedAt: null,
      ...overrides.endpoint
    },
    event: {
      id: jobData.eventId,
      projectId: jobData.projectId,
      eventType: "invoice.created.from-db",
      payload: { fromDatabase: true }
    }
  };
  const repository: DeliveryRepository = {
    findContext: vi.fn(async (eventId, endpointId, projectId) => {
      expect([eventId, endpointId, projectId]).toEqual([jobData.eventId, jobData.endpointId, jobData.projectId]);
      return context;
    }),
    isEndpointDeliverable: vi.fn(async () => overrides.isDeliverable ?? true),
    markProcessing: vi.fn(async () => {}),
    persistAttempt: vi.fn(async () => {}),
    beginReplayTarget: vi.fn(async () => true)
  };
  return { context, repository };
}

function createJob(attemptsMade = 0, attempts = 3) {
  return { data: jobData, attemptsMade, opts: { attempts } };
}

beforeEach(() => {
  process.env.ENDPOINT_SECRET_ENCRYPTION_KEY = Buffer.alloc(32, 5).toString("base64");
});

describe("webhook delivery", () => {

  it("reloads scoped data, ignores the queued URL, signs the exact JSON body and persists success", async () => {
    const { repository, context } = createHarness();
    const validateTarget = vi.fn(async (url: string) => {
      expect(url).toBe(context.endpoint!.url);
      return target;
    });
    const send = vi.fn(async (_target, body, headers, timeoutMs) => {
      expect(_target.url).toBe(trustedUrl);
      expect(JSON.parse(body)).toEqual(context.event!.payload);
      expect(headers["x-relay-event-type"]).toBe(context.event!.eventType);
      expect(headers["x-relay-signature"]).toBe(createWebhookSignature(signingSecret, body));
      expect(timeoutMs).toBe(4321);
      return { statusCode: 204, responseBody: "" };
    });

    await deliverWebhookJob(createJob(), {
      repository,
      requestTimeoutMs: 4321,
      validateTarget,
      send
    });

    expect(repository.findContext).toHaveBeenCalledWith(jobData.eventId, jobData.endpointId, jobData.projectId);
    expect(repository.markProcessing).toHaveBeenCalledWith(jobData.eventId, jobData.projectId);
    expect(validateTarget).toHaveBeenCalledOnce();
    expect(send).toHaveBeenCalledOnce();
    expect(repository.persistAttempt).toHaveBeenCalledWith(expect.objectContaining({
      status: "delivered",
      responseStatusCode: 204,
      errorMessage: null
    }));
    expect(createWebhookSignature(signingSecret, "body")).toBe(
      `sha256=${createHmac("sha256", signingSecret).update("body").digest("hex")}`
    );
  });

  it("skips inactive or deleted endpoints without decrypting secrets or sending", async () => {
    const { repository } = createHarness({
      endpoint: { isActive: false, deletedAt: new Date(), encryptedSecret: "invalid ciphertext" }
    });
    const send = vi.fn();
    await deliverWebhookJob(createJob(), { repository, send });
    expect(send).not.toHaveBeenCalled();
    expect(repository.markProcessing).not.toHaveBeenCalled();
    expect(repository.persistAttempt).toHaveBeenCalledWith(expect.objectContaining({
      status: "skipped",
      errorMessage: "Endpoint is inactive or deleted."
    }));
  });

  it("checks endpoint eligibility again after DNS validation and before sending", async () => {
    const { repository } = createHarness({ isDeliverable: false });
    const validateTarget = vi.fn(async () => target);
    const send = vi.fn();
    await deliverWebhookJob(createJob(), { repository, validateTarget, send });
    expect(repository.isEndpointDeliverable).toHaveBeenCalledWith(jobData.endpointId, jobData.projectId);
    expect(send).not.toHaveBeenCalled();
    expect(repository.persistAttempt).toHaveBeenCalledWith(expect.objectContaining({ status: "skipped" }));
  });

  it("records non-success and redirect responses then lets BullMQ retry without following them", async () => {
    const { repository } = createHarness();
    const send = vi.fn(async () => ({ statusCode: 302, responseBody: "https://redirect.example/" }));
    await expect(deliverWebhookJob(createJob(0, 3), {
      repository,
      validateTarget: async () => target,
      send
    })).rejects.toThrow("HTTP 302");
    expect(send).toHaveBeenCalledOnce();
    expect(repository.persistAttempt).toHaveBeenCalledOnce();
    expect(repository.persistAttempt).toHaveBeenCalledWith(expect.objectContaining({
      status: "retrying",
      responseStatusCode: 302,
      responseBody: "https://redirect.example/",
      errorMessage: "Webhook endpoint returned HTTP 302."
    }));
  });

  it("marks the last failed HTTP attempt terminal", async () => {
    const { repository } = createHarness();
    await expect(deliverWebhookJob(createJob(2, 3), {
      repository,
      validateTarget: async () => target,
      send: async () => ({ statusCode: 503, responseBody: "unavailable" })
    })).rejects.toThrow("Webhook endpoint returned HTTP 503.");
    expect(repository.persistAttempt).toHaveBeenCalledWith(expect.objectContaining({
      status: "failed",
      responseStatusCode: 503
    }));
  });

  it("does not connect when DNS validation rejects a private or changed destination", async () => {
    const { repository } = createHarness();
    const send = vi.fn();
    await expect(deliverWebhookJob(createJob(), {
      repository,
      validateTarget: async () => { throw new Error("resolved private address"); },
      send
    })).rejects.toThrow("Webhook request failed or destination validation was rejected.");
    expect(send).not.toHaveBeenCalled();
    expect(repository.persistAttempt).toHaveBeenCalledWith(expect.objectContaining({
      status: "retrying",
      errorMessage: "Webhook request failed or destination validation was rejected."
    }));
  });

  it("sanitizes transport errors instead of persisting secret-bearing error text", async () => {
    const { repository } = createHarness();
    await expect(deliverWebhookJob(createJob(), {
      repository,
      validateTarget: async () => target,
      send: async () => { throw new Error(`failed for ${signingSecret} with api_key=raw-key`); }
    })).rejects.toThrow("Webhook request failed or destination validation was rejected.");
    const attempt = vi.mocked(repository.persistAttempt).mock.calls[0][0];
    expect(attempt.errorMessage).not.toContain(signingSecret);
    expect(attempt.errorMessage).not.toContain("raw-key");
  });

  it("does not deliver if endpoint, event, or project scope cannot be resolved", async () => {
    const { repository } = createHarness();
    vi.mocked(repository.findContext).mockResolvedValueOnce({ endpoint: null, event: null });
    const send = vi.fn();
    await expect(deliverWebhookJob(createJob(), { repository, send })).rejects.toThrow(
      "Webhook event or endpoint no longer exists."
    );
    expect(send).not.toHaveBeenCalled();
    expect(repository.persistAttempt).not.toHaveBeenCalled();
  });

  it("uses the original event and endpoint context for replay jobs and records replay identity", async () => {
    const { repository } = createHarness();
    const replayData: ReplayDeliveryJobData = {
      replayRequestId: "replay-request-id",
      eventId: jobData.eventId,
      projectId: jobData.projectId,
      endpointId: jobData.endpointId,
      endpointUrl: "https://untrusted-queued-url.example/",
      eventType: "untrusted.queued.type",
      payload: { untrusted: true }
    };
    const send = vi.fn(async () => ({ statusCode: 202, responseBody: "accepted" }));

    await deliverWebhookJob(
      { data: replayData, attemptsMade: 0, opts: { attempts: 3 } },
      { repository, validateTarget: async () => target, send }
    );

    expect(repository.beginReplayTarget).toHaveBeenCalledWith(
      "replay-request-id",
      jobData.eventId,
      jobData.endpointId
    );
    expect(repository.markProcessing).not.toHaveBeenCalled();
    expect(repository.persistAttempt).toHaveBeenCalledWith(expect.objectContaining({
      replayRequestId: "replay-request-id",
      status: "delivered"
    }));
  });

  it("does not redeliver a replay target already marked terminal", async () => {
    const { repository } = createHarness();
    vi.mocked(repository.beginReplayTarget!).mockResolvedValueOnce(false);
    const replayData: ReplayDeliveryJobData = {
      replayRequestId: "replay-request-id",
      eventId: jobData.eventId,
      projectId: jobData.projectId,
      endpointId: jobData.endpointId,
      endpointUrl: trustedUrl,
      eventType: jobData.eventType,
      payload: jobData.payload
    };
    const send = vi.fn();

    await deliverWebhookJob(
      { data: replayData, attemptsMade: 0, opts: { attempts: 3 } },
      { repository, send }
    );

    expect(repository.findContext).not.toHaveBeenCalled();
    expect(repository.persistAttempt).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("does not retry permanent webhook URL validation failures", async () => {
  const { repository } = createHarness();
  const send = vi.fn();

  await expect(
    deliverWebhookJob(createJob(0, 8), {
      repository,
      validateTarget: async () => {
        throw new WebhookUrlError(
          "URL must use HTTPS and point to a public destination.",
          "permanent"
        );
      },
      send
    })
  ).rejects.toThrow(
    "URL must use HTTPS and point to a public destination."
  );

  expect(send).not.toHaveBeenCalled();

  expect(repository.persistAttempt).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "failed",
      errorMessage: "URL must use HTTPS and point to a public destination."
    })
  );
});

it("allows BullMQ to retry temporary DNS resolution failures", async () => {
  const { repository } = createHarness();
  const send = vi.fn();

  await expect(
    deliverWebhookJob(createJob(0, 8), {
      repository,
      validateTarget: async () => {
        throw new WebhookUrlError(
          "URL could not be resolved to a public destination.",
          "retryable"
        );
      },
      send
    })
  ).rejects.toThrow(
    "Webhook request failed or destination validation was rejected."
  );

  expect(send).not.toHaveBeenCalled();

  expect(repository.persistAttempt).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "retrying",
      errorMessage: "Webhook request failed or destination validation was rejected."
    })
  );
});
});
