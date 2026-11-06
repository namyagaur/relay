import { describe, expect, it, vi } from "vitest";
import {
  dispatchOutboxBatch,
  type DeliveryJobQueue,
  type OutboxRepository
} from "../src/services/outbox-dispatcher";
import { getOutboxConfig } from "../src/config/outbox";
import { validateRedisUrl } from "../src/queue/delivery-queue";

const message = {
  id: "outbox-1",
  eventId: "event-1",
  eventType: "invoice.created",
  payload: { invoiceId: "inv-1" },
  event: {
    projectId: "project-1",
    project: {
      endpoints: [
        { id: "endpoint-1", url: "https://one.example.org/hook" },
        { id: "endpoint-2", url: "https://two.example.org/hook" }
      ]
    }
  }
};

function createHarness(messages = [message]) {
  let published = false;
  const repository: OutboxRepository = {
    findUnpublished: vi.fn(async () => published ? [] : messages),
    publishWithoutEndpoints: vi.fn(async () => {
      published = true;
      return true;
    }),
    markPublished: vi.fn(async () => {
      published = true;
      return true;
    })
  };
  const queue: DeliveryJobQueue = { add: vi.fn(async () => ({})) };
  return { repository, queue, isPublished: () => published };
}

describe("outbox dispatcher", () => {
  it("enqueues one deterministic job per endpoint and publishes after all succeed", async () => {
    const harness = createHarness();
    const result = await dispatchOutboxBatch({
      ...harness,
      batchSize: 10,
      now: () => new Date("2026-01-01T00:00:00Z")
    });

    expect(result).toEqual({
      messagesFound: 1,
      messagesPublished: 1,
      messagesFailed: 0,
      jobsEnqueued: 2
    });
    expect(harness.queue.add).toHaveBeenNthCalledWith(1, "deliver-webhook", expect.objectContaining({
      eventId: "event-1",
      projectId: "project-1",
      endpointId: "endpoint-1",
      payload: message.payload
    }), { jobId: "delivery-event-1-endpoint-1" });
    expect(harness.queue.add).toHaveBeenNthCalledWith(2, "deliver-webhook", expect.objectContaining({
      endpointId: "endpoint-2"
    }), { jobId: "delivery-event-1-endpoint-2" });
    expect(harness.repository.markPublished).toHaveBeenCalledWith(
      "outbox-1",
      new Date("2026-01-01T00:00:00Z")
    );
    expect(harness.isPublished()).toBe(true);
  });

  it("marks an outbox message with no eligible endpoints published", async () => {
    const harness = createHarness([{
      ...message,
      event: { ...message.event, project: { endpoints: [] } }
    }]);
    const result = await dispatchOutboxBatch({ ...harness, batchSize: 10 });
    expect(result.messagesPublished).toBe(1);
    expect(result.jobsEnqueued).toBe(0);
    expect(harness.queue.add).not.toHaveBeenCalled();
    expect(harness.repository.publishWithoutEndpoints).toHaveBeenCalledWith(
      "outbox-1",
      "event-1",
      "project-1",
      expect.any(Date)
    );
    expect(harness.repository.markPublished).not.toHaveBeenCalled();
  });

  it("does not mark a message published when Redis is unavailable", async () => {
    const harness = createHarness();
    vi.mocked(harness.queue.add).mockRejectedValue(new Error("redis failure"));
    const result = await dispatchOutboxBatch({ ...harness, batchSize: 10 });
    expect(result.messagesFailed).toBe(1);
    expect(harness.isPublished()).toBe(false);
    expect(harness.repository.markPublished).not.toHaveBeenCalled();
  });

  it("leaves a partially enqueued message unpublished and retries remaining jobs", async () => {
    const harness = createHarness();
    vi.mocked(harness.queue.add)
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("temporary Redis failure"))
      .mockResolvedValue({});

    const first = await dispatchOutboxBatch({ ...harness, batchSize: 10 });
    expect(first.messagesFailed).toBe(1);
    expect(first.messagesPublished).toBe(0);
    expect(harness.isPublished()).toBe(false);
    expect(harness.repository.markPublished).not.toHaveBeenCalled();

    const second = await dispatchOutboxBatch({ ...harness, batchSize: 10 });
    expect(second.messagesPublished).toBe(1);
    expect(harness.isPublished()).toBe(true);
    expect(harness.queue.add).toHaveBeenCalledTimes(4);

expect(harness.queue.add).toHaveBeenNthCalledWith(
  3,
  "deliver-webhook",
  expect.objectContaining({ endpointId: "endpoint-1" }),
  { jobId: "delivery-event-1-endpoint-1" }
);

expect(harness.queue.add).toHaveBeenNthCalledWith(
  4,
  "deliver-webhook",
  expect.objectContaining({ endpointId: "endpoint-2" }),
  { jobId: "delivery-event-1-endpoint-2" }
);
  });

  it("uses repeated polling safely and avoids re-enqueueing already-published rows", async () => {
    const harness = createHarness();
    const first = await dispatchOutboxBatch({ ...harness, batchSize: 10 });
    const second = await dispatchOutboxBatch({ ...harness, batchSize: 10 });
    expect(first.messagesPublished).toBe(1);
    expect(second.messagesFound).toBe(0);
    expect(harness.queue.add).toHaveBeenCalledTimes(2);
  });

  it("recovers if the dispatcher fails after enqueueing but before marking published", async () => {
    const harness = createHarness();
    const queuedJobIds = new Set<string>();
    vi.mocked(harness.queue.add).mockImplementation(async (_name, _data, options) => {
      queuedJobIds.add(options.jobId);
      return {};
    });
    vi.mocked(harness.repository.markPublished)
      .mockRejectedValueOnce(new Error("database temporarily unavailable"))
      .mockResolvedValueOnce(true);

    const first = await dispatchOutboxBatch({ ...harness, batchSize: 10 });
    const second = await dispatchOutboxBatch({ ...harness, batchSize: 10 });
    expect(first.messagesFailed).toBe(1);
    expect(second.messagesPublished).toBe(1);
    expect(harness.queue.add).toHaveBeenCalledTimes(4);
    expect(queuedJobIds.size).toBe(2);
  });

  it("rejects invalid polling configuration and supplies safe defaults", () => {
    expect(getOutboxConfig({})).toEqual({ pollIntervalMs: 1000, batchSize: 100 });
    expect(getOutboxConfig({
      OUTBOX_POLL_INTERVAL_MS: "2500",
      OUTBOX_BATCH_SIZE: "25"
    })).toEqual({ pollIntervalMs: 2500, batchSize: 25 });
    expect(() => getOutboxConfig({ OUTBOX_BATCH_SIZE: "0" })).toThrow(/positive integer/);
  });

  it("accepts TLS Redis URLs for Upstash without exposing credentials", () => {
    const redisUrl = validateRedisUrl("rediss://default:secret-token@free-redis.upstash.io:6379");
    expect(redisUrl.protocol).toBe("rediss:");
    expect(redisUrl.hostname).toBe("free-redis.upstash.io");
    expect(() => validateRedisUrl(undefined)).toThrow(/REDIS_URL/);
    expect(() => validateRedisUrl("https://redis.example.org")).toThrow(/redis:\/\//);
  });
});
