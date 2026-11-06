import type { Prisma } from "../generated/prisma/client";
import type { DeliveryJobData } from "../queue/delivery-queue";

interface OutboxEndpoint {
  id: string;
  url: string;
}

interface UnpublishedOutboxMessage {
  id: string;
  eventId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  event: {
    projectId: string;
    project: { endpoints: OutboxEndpoint[] };
  };
}

export interface OutboxRepository {
  findUnpublished(batchSize: number): Promise<UnpublishedOutboxMessage[]>;
  publishWithoutEndpoints(
    outboxMessageId: string,
    eventId: string,
    projectId: string,
    publishedAt: Date
  ): Promise<boolean>;
  markPublished(id: string, publishedAt: Date): Promise<boolean>;
}

export interface DeliveryJobQueue {
  add(name: string, data: DeliveryJobData, options: { jobId: string }): Promise<unknown>;
}

export interface DispatchBatchResult {
  messagesFound: number;
  messagesPublished: number;
  messagesFailed: number;
  jobsEnqueued: number;
}

export async function dispatchOutboxBatch(options: {
  repository: OutboxRepository;
  queue: DeliveryJobQueue;
  batchSize: number;
  now?: () => Date;
}): Promise<DispatchBatchResult> {
  const messages = await options.repository.findUnpublished(options.batchSize);
  const result: DispatchBatchResult = {
    messagesFound: messages.length,
    messagesPublished: 0,
    messagesFailed: 0,
    jobsEnqueued: 0
  };

  for (const message of messages) {
    let messageJobsEnqueued = 0;
    try {
      if (message.event.project.endpoints.length === 0) {
        const marked = await options.repository.publishWithoutEndpoints(
          message.id,
          message.eventId,
          message.event.projectId,
          (options.now ?? (() => new Date()))()
        );
        if (marked) result.messagesPublished += 1;
        continue;
      }

      for (const endpoint of message.event.project.endpoints) {
        await options.queue.add("deliver-webhook", {
          outboxMessageId: message.id,
          eventId: message.eventId,
          projectId: message.event.projectId,
          endpointId: endpoint.id,
          endpointUrl: endpoint.url,
          eventType: message.eventType,
          payload: message.payload
        }, {
          jobId: `delivery-${message.eventId}-${endpoint.id}`
        });
        messageJobsEnqueued += 1;
      }

      const marked = await options.repository.markPublished(message.id, (options.now ?? (() => new Date()))());
      result.jobsEnqueued += messageJobsEnqueued;
      if (marked) result.messagesPublished += 1;
    } catch {
      result.jobsEnqueued += messageJobsEnqueued;
      result.messagesFailed += 1;
    }
  }

  return result;
}
