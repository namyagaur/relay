import "dotenv/config";
import { getOutboxConfig } from "./config/outbox";
import { errorName, createOutboxProcessLifecycle } from "./workers/outbox-process";
import type { createDeliveryQueue as createDeliveryQueueType } from "./queue/delivery-queue.js";
import type { startOutboxDispatcher as startOutboxDispatcherType } from "./workers/outbox-dispatcher.js";

async function main(): Promise<void> {
  let queueConnection: ReturnType<typeof createDeliveryQueueType> | undefined;
  let dispatcher: ReturnType<typeof startOutboxDispatcherType> | undefined;
  let disconnectPrisma: (() => Promise<void>) | undefined;

  try {
    const config = getOutboxConfig();
    const [{ prisma }, { createDeliveryQueue }, { startOutboxDispatcher }] = await Promise.all([
      import("./config/prisma.js"),
      import("./queue/delivery-queue.js"),
      import("./workers/outbox-dispatcher.js")
    ]);

    disconnectPrisma = () => prisma.$disconnect();
    const activeQueueConnection = createDeliveryQueue();
    queueConnection = activeQueueConnection;
    const activeDispatcher = startOutboxDispatcher({
      queue: activeQueueConnection.queue,
      ...config,
      onDispatchError: () => console.error("Outbox dispatch failed; unpublished messages will be retried.")
    });
    dispatcher = activeDispatcher;
    createOutboxProcessLifecycle({
      dispatcher: activeDispatcher,
      closeQueue: () => activeQueueConnection.close(),
      disconnectPrisma
    });

    console.log("Outbox dispatcher started.");
  } catch (error) {
    const cleanupErrors: unknown[] = [];
    for (const cleanup of [
      dispatcher ? () => dispatcher?.close() : undefined,
      queueConnection ? () => queueConnection?.close() : undefined,
      disconnectPrisma
    ]) {
      if (!cleanup) continue;
      try {
        await cleanup();
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError);
      }
    }
    const details = [errorName(error), ...cleanupErrors.map(errorName)].join(", ");
    throw new Error(`Outbox dispatcher startup failed (${details}).`);
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Outbox dispatcher startup failed (UnknownError).");
    process.exitCode = 1;
  });
}
