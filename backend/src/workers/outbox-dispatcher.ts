import type { DeliveryJobQueue } from "../services/outbox-dispatcher";
import { dispatchOutboxBatch } from "../services/outbox-dispatcher";
import {
  findUnpublishedOutboxMessages,
  markOutboxMessagePublished,
  publishWithoutEndpoints
} from "../services/outbox-repository";

export interface DispatcherLifecycle {
  close(): Promise<void>;
}

export function startOutboxDispatcher(options: {
  queue: DeliveryJobQueue;
  pollIntervalMs: number;
  batchSize: number;
  onDispatchError?: () => void;
}): DispatcherLifecycle {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let inFlight: Promise<void> | undefined;

  const poll = async (): Promise<void> => {
    if (stopped) return;
    inFlight = (async () => {
      try {
        const result = await dispatchOutboxBatch({
          repository: {
            findUnpublished: findUnpublishedOutboxMessages,
            publishWithoutEndpoints,
            markPublished: markOutboxMessagePublished
          },
          queue: options.queue,
          batchSize: options.batchSize
        });
        if (result.messagesFailed > 0) options.onDispatchError?.();
      } catch {
        options.onDispatchError?.();
      } finally {
        inFlight = undefined;
        if (!stopped) timer = setTimeout(() => void poll(), options.pollIntervalMs);
      }
    })();
    await inFlight;
  };

  void poll();

  return {
    async close(): Promise<void> {
      stopped = true;
      if (timer) clearTimeout(timer);
      await inFlight;
    }
  };
}
