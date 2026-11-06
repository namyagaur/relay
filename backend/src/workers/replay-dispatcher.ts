import type { ReplayQueue } from "../services/replay-dispatcher";
import { dispatchReplayBatch } from "../services/replay-dispatcher";
import { prismaReplayDispatcherRepository } from "../services/replay-repository";

export interface ReplayDispatcherLifecycle {
  close(): Promise<void>;
}

export function startReplayDispatcher(options: {
  queue: ReplayQueue;
  pollIntervalMs: number;
  batchSize: number;
  onDispatchError?: () => void;
}): ReplayDispatcherLifecycle {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let inFlight: Promise<void> | undefined;

  const poll = async (): Promise<void> => {
    if (stopped) return;
    inFlight = (async () => {
      try {
        const result = await dispatchReplayBatch({
          repository: prismaReplayDispatcherRepository,
          queue: options.queue,
          batchSize: options.batchSize
        });
        if (result.requestsFailed > 0) options.onDispatchError?.();
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
