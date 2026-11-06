import type { ReplayDeliveryJobData } from "../queue/delivery-queue";

export interface ReplayRequestToDispatch {
  id: string;
  eventId: string;
  projectId: string;
  eventType: string;
  payload: ReplayDeliveryJobData["payload"];
  targets: Array<{ endpointId: string; endpointUrl: string }>;
}

export interface ReplayDispatcherRepository {
  findDispatchable(batchSize: number): Promise<ReplayRequestToDispatch[]>;
}

export interface ReplayQueue {
  add(
    name: "deliver-webhook-replay",
    data: ReplayDeliveryJobData,
    options: { jobId: string; removeOnComplete: true; removeOnFail: true }
  ): Promise<unknown>;
}

export interface ReplayDispatchResult {
  requestsFound: number;
  requestsEnqueued: number;
  requestsFailed: number;
  jobsEnqueued: number;
}

export async function dispatchReplayBatch(options: {
  repository: ReplayDispatcherRepository;
  queue: ReplayQueue;
  batchSize: number;
}): Promise<ReplayDispatchResult> {
  const requests = await options.repository.findDispatchable(options.batchSize);
  const result: ReplayDispatchResult = {
    requestsFound: requests.length,
    requestsEnqueued: 0,
    requestsFailed: 0,
    jobsEnqueued: 0
  };

  for (const replayRequest of requests) {
    let failed = false;
    let enqueued = 0;
    for (const target of replayRequest.targets) {
      try {
        await options.queue.add("deliver-webhook-replay", {
          replayRequestId: replayRequest.id,
          eventId: replayRequest.eventId,
          projectId: replayRequest.projectId,
          endpointId: target.endpointId,
          endpointUrl: target.endpointUrl,
          eventType: replayRequest.eventType,
          payload: replayRequest.payload
        }, {
          jobId: `replay-${replayRequest.id}-${target.endpointId}`,
          removeOnComplete: true,
          removeOnFail: true
        });
        enqueued += 1;
      } catch {
        failed = true;
      }
    }
    result.jobsEnqueued += enqueued;
    if (failed) result.requestsFailed += 1;
    else result.requestsEnqueued += 1;
  }
  return result;
}
