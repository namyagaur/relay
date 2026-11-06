import "dotenv/config";
import { getDeliveryConfig } from "./config/delivery";
import { getOutboxConfig } from "./config/outbox";
import type { createDeliveryWorker as CreateDeliveryWorker } from "./queue/delivery-queue.js";
import type { createDeliveryQueue as CreateDeliveryQueue } from "./queue/delivery-queue.js";
import type { startReplayDispatcher as StartReplayDispatcher } from "./workers/replay-dispatcher.js";

async function main(): Promise<void> {
  const config = getDeliveryConfig();
  const { prisma } = await import("./config/prisma.js");

  let deliveryWorker: ReturnType<typeof CreateDeliveryWorker> | undefined;
  let deliveryQueue: ReturnType<typeof CreateDeliveryQueue> | undefined;
  let replayDispatcher: ReturnType<typeof StartReplayDispatcher> | undefined;
  try {
    const [{ createDeliveryWorker, createDeliveryQueue }, { startReplayDispatcher }] = await Promise.all([
      import("./queue/delivery-queue.js"),
      import("./workers/replay-dispatcher.js")
    ]);
    deliveryWorker = createDeliveryWorker(config);
    deliveryQueue = createDeliveryQueue();
    replayDispatcher = startReplayDispatcher({
      queue: deliveryQueue.queue,
      ...getOutboxConfig(),
      onDispatchError: () => console.error("Replay dispatch failed; durable requests will be retried.")
    });
  } catch (error) {
    const cleanupErrors: unknown[] = [];
    for (const cleanup of [
      replayDispatcher ? () => replayDispatcher?.close() : undefined,
      deliveryQueue ? () => deliveryQueue?.close() : undefined,
      deliveryWorker ? () => deliveryWorker?.close() : undefined,
      () => prisma.$disconnect()
    ]) {
      if (!cleanup) continue;
      try {
        await cleanup();
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    if (cleanupErrors.length > 0) {
      throw new AggregateError([error, ...cleanupErrors], "Delivery worker startup and cleanup failed.");
    }
    throw error;
  }
  if (!deliveryWorker) throw new Error("Delivery worker failed to initialize.");
  let shutdown: Promise<void> | undefined;
  const close = (): Promise<void> => {
    if (!shutdown) {
      shutdown = (async () => {
        const errors: unknown[] = [];
        for (const cleanup of [
          replayDispatcher ? () => replayDispatcher?.close() : undefined,
          deliveryQueue ? () => deliveryQueue?.close() : undefined,
          () => deliveryWorker.close(),
          () => prisma.$disconnect()
        ]) {
          if (!cleanup) continue;
          try {
            await cleanup();
          } catch (error) {
            errors.push(error);
          }
        }
        if (errors.length > 0) throw new AggregateError(errors, "Delivery worker shutdown failed.");
      })();
    }
    return shutdown;
  };

  const onSignal = (): void => {
    void close().catch(() => {
      console.error("Delivery worker shutdown failed.");
      process.exitCode = 1;
    }).finally(() => {
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
    });
  };

  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  console.log("Webhook delivery worker started.");
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error("Webhook delivery worker could not start. Check database, Redis and worker configuration.");
    process.exitCode = 1;
  });
}
