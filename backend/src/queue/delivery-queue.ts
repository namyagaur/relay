import { Queue, UnrecoverableError, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import type { Prisma } from "../generated/prisma/client";
import { prismaDeliveryRepository } from "../services/delivery-repository";
import { deliverWebhookJob, type DeliverWebhookOptions } from "../services/webhook-delivery";
import type { DeliveryJobQueue } from "../services/outbox-dispatcher";

export const DELIVERY_QUEUE_NAME = "relay-webhook-deliveries";

export interface DeliveryJobData {
  outboxMessageId: string;
  eventId: string;
  projectId: string;
  endpointId: string;
  endpointUrl: string;
  eventType: string;
  payload: Prisma.JsonValue;
}

export interface ReplayDeliveryJobData {
  replayRequestId: string;
  eventId: string;
  projectId: string;
  endpointId: string;
  endpointUrl: string;
  eventType: string;
  payload: Prisma.JsonValue;
}

export type DeliveryQueueJobData = DeliveryJobData | ReplayDeliveryJobData;

export function validateRedisUrl(redisUrl: string | undefined): URL {
  if (!redisUrl) {
    throw new Error("REDIS_URL must be set to initialize the delivery queue.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(redisUrl);
  } catch {
    throw new Error("REDIS_URL must be a valid Redis connection URL.");
  }

  if (!["redis:", "rediss:"].includes(parsedUrl.protocol) || !parsedUrl.hostname) {
    throw new Error("REDIS_URL must use the redis:// or rediss:// protocol.");
  }

  return parsedUrl;
}

function createRedisConnection(redisUrl: string) {
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5000)
  });
  connection.on("error", () => {
    console.error("Redis connection error; retrying.");
  });
  return connection;
}

export function createDeliveryQueue(
  redisUrl = process.env.REDIS_URL,
  queueName?: string
) {
  if (queueName !== undefined && process.env.NODE_ENV !== "test") {
    throw new Error("Custom delivery queue names are only available in the test environment.");
  }

  validateRedisUrl(redisUrl);
  if (!redisUrl) throw new Error("REDIS_URL must be set to initialize the delivery queue.");

  const connection = createRedisConnection(redisUrl);
  const queue = new Queue<DeliveryQueueJobData>(queueName ?? DELIVERY_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 8,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10000 },
      removeOnFail: { age: 30 * 24 * 60 * 60, count: 50000 }
    }
  });

  let closePromise: Promise<void> | undefined;
  return {
    queue,
    close(): Promise<void> {
      if (!closePromise) {
        closePromise = (async () => {
          try {
            await queue.close();
          } finally {
            if (connection.status !== "end") connection.disconnect();
          }
        })();
      }
      return closePromise;
    }
  };
}

export function createDeliveryWorker(options: {
  redisUrl?: string;
  requestTimeoutMs: number;
  concurrency: number;
  testDeliveryOverrides?: Pick<DeliverWebhookOptions, "validateTarget" | "send">;
  testQueueName?: string;
}) {
  if (
    (options.testDeliveryOverrides || options.testQueueName) &&
    process.env.NODE_ENV !== "test"
  ) {
    throw new Error("Test delivery overrides are only available in the test environment.");
  }

  const redisUrl = options.redisUrl ?? process.env.REDIS_URL;
  validateRedisUrl(redisUrl);
  if (!redisUrl) throw new Error("REDIS_URL must be set to initialize the delivery worker.");

  const connection = createRedisConnection(redisUrl);
  const worker = new Worker<DeliveryQueueJobData>(
    options.testQueueName ?? DELIVERY_QUEUE_NAME,
    async (job: Job<DeliveryQueueJobData>) => {
      try {
        await deliverWebhookJob(job, {
          repository: prismaDeliveryRepository,
          requestTimeoutMs: options.requestTimeoutMs,
          ...options.testDeliveryOverrides
        });
      } catch (error) {
        if (
          "replayRequestId" in job.data &&
          (error instanceof UnrecoverableError || job.attemptsMade + 1 >= (job.opts.attempts ?? 1))
        ) {
          await prismaDeliveryRepository.failReplayTarget(
            job.data.replayRequestId,
            job.data.eventId,
            job.data.endpointId
          );
        }
        throw error;
      }
    },
    { connection, concurrency: options.concurrency }
  );
  worker.on("failed", () => {
    console.error("Webhook delivery attempt failed; BullMQ will retry when configured.");
  });
  worker.on("error", () => {
    console.error("Webhook delivery worker error.");
  });

  let closePromise: Promise<void> | undefined;
  return {
    worker,
    close(): Promise<void> {
      if (!closePromise) {
        closePromise = (async () => {
          try {
            await worker.close();
          } finally {
            if (connection.status !== "end") connection.disconnect();
          }
        })();
      }
      return closePromise;
    }
  };
}

export type DeliveryWorker = ReturnType<typeof createDeliveryWorker>;
export type DeliveryQueue = ReturnType<typeof createDeliveryQueue>;
export type DeliveryQueueLike = DeliveryJobQueue;
