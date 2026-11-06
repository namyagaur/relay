import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queueClose: vi.fn(),
  redisDisconnect: vi.fn(),
  redisOn: vi.fn(),
  queueName: undefined as string | undefined,
  queueOptions: undefined as unknown,
  workerClose: vi.fn(),
  workerOptions: undefined as unknown,
  workerProcessor: undefined as unknown,
  deliverWebhookJob: vi.fn(),
  failReplayTarget: vi.fn()
}));

vi.mock("ioredis", () => ({
  default: class {
    status = "ready";
    constructor(..._args: unknown[]) {}
    on(...args: unknown[]) {
      mocks.redisOn(...args);
    }
    disconnect() {
      mocks.redisDisconnect();
    }
  }
}));

vi.mock("bullmq", () => ({
  UnrecoverableError: class extends Error {},
  Queue: class {
    constructor(name: string, options: unknown) {
      mocks.queueName = name;
      mocks.queueOptions = options;
    }
    close() {
      return mocks.queueClose();
    }
  },
  Worker: class {
    constructor(_name: string, processor: unknown, options: unknown) {
      mocks.workerProcessor = processor;
      mocks.workerOptions = options;
    }
    on() {}
    close() {
      return mocks.workerClose();
    }
  }
}));

vi.mock("../src/services/webhook-delivery", () => ({
  deliverWebhookJob: mocks.deliverWebhookJob
}));

vi.mock("../src/services/delivery-repository", () => ({
  prismaDeliveryRepository: {
    findContext: vi.fn(),
    isEndpointDeliverable: vi.fn(),
    markProcessing: vi.fn(),
    persistAttempt: vi.fn(),
    beginReplayTarget: vi.fn(),
    failReplayTarget: mocks.failReplayTarget
  }
}));

import { createDeliveryQueue, createDeliveryWorker } from "../src/queue/delivery-queue";

describe("delivery queue lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queueName = undefined;
  });

  it("reuses its close promise and disconnects Redis after closing BullMQ", async () => {
    mocks.queueClose.mockResolvedValue(undefined);
    const connection = createDeliveryQueue("rediss://default:token@redis.example.org:6379");
    const firstClose = connection.close();
    const secondClose = connection.close();
    expect(firstClose).toBe(secondClose);
    await firstClose;
    expect(mocks.queueClose).toHaveBeenCalledOnce();
    expect(mocks.redisDisconnect).toHaveBeenCalledOnce();
    expect(mocks.queueOptions).toMatchObject({
      defaultJobOptions: {
        attempts: 8,
        backoff: { type: "exponential", delay: 1000 }
      }
    });
  });

  it("disconnects Redis even if BullMQ queue shutdown fails", async () => {
    mocks.queueClose.mockRejectedValue(new Error("queue close failed"));
    const connection = createDeliveryQueue("redis://localhost:6379");
    await expect(connection.close()).rejects.toThrow("queue close failed");
    expect(mocks.redisDisconnect).toHaveBeenCalledOnce();
  });

  it("rejects custom queue names outside the test environment", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(() => createDeliveryQueue("redis://localhost:6379", "relay-test-queue"))
        .toThrow("Custom delivery queue names are only available in the test environment.");
    } finally {
      vi.unstubAllEnvs();
    }
    expect(mocks.queueName).toBeUndefined();
  });

  it("accepts a custom queue name in the test environment", async () => {
    vi.stubEnv("NODE_ENV", "test");
    mocks.queueClose.mockResolvedValue(undefined);
    try {
      const connection = createDeliveryQueue("redis://localhost:6379", "relay-test-queue");
      expect(mocks.queueName).toBe("relay-test-queue");
      await connection.close();
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("creates a dedicated worker with configured concurrency and closes it cleanly", async () => {
    mocks.workerClose.mockResolvedValue(undefined);
    mocks.failReplayTarget.mockResolvedValue(undefined);
    const deliveryWorker = createDeliveryWorker({
      redisUrl: "rediss://default:token@redis.example.org:6379",
      requestTimeoutMs: 5000,
      concurrency: 3
    });
    expect(mocks.workerOptions).toMatchObject({ concurrency: 3 });
    await deliveryWorker.close();
    expect(mocks.workerClose).toHaveBeenCalledOnce();
    expect(mocks.redisDisconnect).toHaveBeenCalledOnce();
  });

  it("rejects test delivery overrides outside the test environment", () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      expect(() => createDeliveryWorker({
        redisUrl: "redis://localhost:6379",
        requestTimeoutMs: 5000,
        concurrency: 1,
        testDeliveryOverrides: { validateTarget: vi.fn() }
      })).toThrow("Test delivery overrides are only available in the test environment.");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("marks replay targets failed when a delivery job exhausts its retries", async () => {
    const deliveryWorker = createDeliveryWorker({
      redisUrl: "redis://localhost:6379",
      requestTimeoutMs: 5000,
      concurrency: 1
    });
    const processor = mocks.workerProcessor as (job: unknown) => Promise<void>;
    const replayJob = {
      data: {
        replayRequestId: "replay-id",
        eventId: "event-id",
        endpointId: "endpoint-id",
        projectId: "project-id",
        endpointUrl: "https://example.com",
        eventType: "test",
        payload: {}
      },
      attemptsMade: 0,
      opts: { attempts: 1 }
    };
    mocks.deliverWebhookJob.mockRejectedValueOnce(new Error("delivery failed"));

    await expect(processor(replayJob)).rejects.toThrow("delivery failed");
    expect(mocks.failReplayTarget).toHaveBeenCalledWith("replay-id", "event-id", "endpoint-id");
    await deliveryWorker.close();
  });
});
