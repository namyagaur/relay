import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchReplayBatch, type ReplayRequestToDispatch } from "../src/services/replay-dispatcher";

const request: ReplayRequestToDispatch = {
  id: "11111111-1111-4111-8111-111111111111",
  eventId: "22222222-2222-4222-8222-222222222222",
  projectId: "33333333-3333-4333-8333-333333333333",
  eventType: "invoice.paid",
  payload: { invoiceId: "inv_123" },
  targets: [
    { endpointId: "44444444-4444-4444-8444-444444444444", endpointUrl: "https://one.example/hook" },
    { endpointId: "55555555-5555-4555-8555-555555555555", endpointUrl: "https://two.example/hook" }
  ]
};

describe("replay dispatch", () => {
  let queueAdd: ReturnType<typeof vi.fn>;
  const repository = { findDispatchable: vi.fn(async () => [request]) };

  beforeEach(() => {
    vi.clearAllMocks();
    queueAdd = vi.fn(async () => ({}));
  });

  it("enqueues one stable job per failed target with request-specific IDs", async () => {
    const result = await dispatchReplayBatch({
      repository,
      queue: { add: queueAdd },
      batchSize: 10
    });

    expect(result).toEqual({
      requestsFound: 1,
      requestsEnqueued: 1,
      requestsFailed: 0,
      jobsEnqueued: 2
    });
    expect(queueAdd).toHaveBeenNthCalledWith(1, "deliver-webhook-replay", expect.objectContaining({
      replayRequestId: request.id,
      eventId: request.eventId,
      endpointId: request.targets[0].endpointId,
      payload: request.payload
    }), {
      jobId: `replay-${request.id}-${request.targets[0].endpointId}`,
      removeOnComplete: true,
      removeOnFail: true
    });

    const secondRequest = { ...request, id: "66666666-6666-4666-8666-666666666666" };
    repository.findDispatchable.mockResolvedValueOnce([secondRequest]);
    await dispatchReplayBatch({ repository, queue: { add: queueAdd }, batchSize: 10 });
    expect(queueAdd.mock.calls[2][2]).toMatchObject({
      jobId: `replay-${secondRequest.id}-${secondRequest.targets[0].endpointId}`
    });
  });

  it("keeps partial enqueue failures recoverable and retries with the same job IDs", async () => {
    queueAdd.mockRejectedValueOnce(new Error("Redis unavailable"));
    let result = await dispatchReplayBatch({
      repository,
      queue: { add: queueAdd },
      batchSize: 10
    });
    expect(result).toMatchObject({ requestsFailed: 1, jobsEnqueued: 1, requestsEnqueued: 0 });

    queueAdd.mockResolvedValue({});
    result = await dispatchReplayBatch({
      repository,
      queue: { add: queueAdd },
      batchSize: 10
    });
    expect(result).toMatchObject({ requestsFailed: 0, requestsEnqueued: 1, jobsEnqueued: 2 });
    expect(queueAdd.mock.calls[0][2].jobId).toBe(queueAdd.mock.calls[2][2].jobId);
    expect(queueAdd.mock.calls[1][2].jobId).toBe(queueAdd.mock.calls[3][2].jobId);
  });
});
