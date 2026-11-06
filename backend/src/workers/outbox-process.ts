import type { DispatcherLifecycle } from "./outbox-dispatcher";

type Signal = "SIGINT" | "SIGTERM";

interface SignalSource {
  on(signal: Signal, listener: () => void): unknown;
  off(signal: Signal, listener: () => void): unknown;
}

export interface OutboxProcessLifecycle {
  close(): Promise<void>;
}

export function createOutboxProcessLifecycle(options: {
  dispatcher: DispatcherLifecycle;
  closeQueue: () => Promise<void>;
  disconnectPrisma: () => Promise<void>;
  signalSource?: SignalSource;
  onShutdownError?: (error: unknown) => void;
}): OutboxProcessLifecycle {
  const signalSource = options.signalSource ?? process;
  let shutdown: Promise<void> | undefined;

  const close = (): Promise<void> => {
    if (!shutdown) {
      shutdown = (async () => {
        const errors: unknown[] = [];
        for (const cleanup of [
          () => options.dispatcher.close(),
          options.closeQueue,
          options.disconnectPrisma
        ]) {
          try {
            await cleanup();
          } catch (error) {
            errors.push(error);
          }
        }

        signalSource.off("SIGINT", onSignal);
        signalSource.off("SIGTERM", onSignal);
        if (errors.length === 1) throw errors[0];
        if (errors.length > 1) throw new AggregateError(errors, "Multiple outbox shutdown steps failed.");
      })();
    }
    return shutdown;
  };

  const onSignal = (): void => {
    void close().catch((error: unknown) => {
      if (options.onShutdownError) options.onShutdownError(error);
      else console.error(`Outbox dispatcher shutdown failed (${errorName(error)}).`);
      process.exitCode = 1;
    });
  };

  signalSource.on("SIGINT", onSignal);
  signalSource.on("SIGTERM", onSignal);

  return { close };
}

export function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}
