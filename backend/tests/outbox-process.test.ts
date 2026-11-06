import { describe, expect, it, vi } from "vitest";
import { createOutboxProcessLifecycle } from "../src/workers/outbox-process";

class FakeSignals {
  private listeners = new Map<string, () => void>();

  on(signal: string, listener: () => void): void {
    this.listeners.set(signal, listener);
  }

  off(signal: string, listener: () => void): void {
    if (this.listeners.get(signal) === listener) this.listeners.delete(signal);
  }

  emit(signal: string): void {
    this.listeners.get(signal)?.();
  }

  listenerCount(): number {
    return this.listeners.size;
  }
}

describe("outbox process lifecycle", () => {
  it("waits for the active dispatch and closes resources in order once", async () => {
    const signals = new FakeSignals();
    let finishDispatch: (() => void) | undefined;
    const dispatcherClose = vi.fn(() => new Promise<void>((resolve) => {
      finishDispatch = resolve;
    }));
    const closeQueue = vi.fn(async () => {});
    const disconnectPrisma = vi.fn(async () => {});
    const lifecycle = createOutboxProcessLifecycle({
      dispatcher: { close: dispatcherClose },
      closeQueue,
      disconnectPrisma,
      signalSource: signals
    });

    signals.emit("SIGTERM");
    signals.emit("SIGINT");
    const duplicateClose = lifecycle.close();
    await Promise.resolve();
    expect(dispatcherClose).toHaveBeenCalledOnce();
    expect(closeQueue).not.toHaveBeenCalled();
    finishDispatch?.();
    await duplicateClose;

    expect(closeQueue).toHaveBeenCalledOnce();
    expect(disconnectPrisma).toHaveBeenCalledOnce();
    expect(signals.listenerCount()).toBe(0);
  });

  it("attempts every cleanup step and reports aggregate shutdown errors", async () => {
    const signals = new FakeSignals();
    const onShutdownError = vi.fn();
    const lifecycle = createOutboxProcessLifecycle({
      dispatcher: { close: vi.fn(async () => { throw new Error("dispatcher failure"); }) },
      closeQueue: vi.fn(async () => { throw new Error("queue failure"); }),
      disconnectPrisma: vi.fn(async () => {}),
      signalSource: signals,
      onShutdownError
    });

    signals.emit("SIGINT");
    await vi.waitFor(() => expect(onShutdownError).toHaveBeenCalledOnce());
    expect(onShutdownError.mock.calls[0][0]).toBeInstanceOf(AggregateError);
  });

  it("is safe when queue close fails and still disconnects Prisma", async () => {
    const disconnectPrisma = vi.fn(async () => {});
    const lifecycle = createOutboxProcessLifecycle({
      dispatcher: { close: vi.fn(async () => {}) },
      closeQueue: vi.fn(async () => { throw new Error("queue failure"); }),
      disconnectPrisma
    });

    await expect(lifecycle.close()).rejects.toThrow("queue failure");
    await expect(lifecycle.close()).rejects.toThrow("queue failure");
    expect(disconnectPrisma).toHaveBeenCalledOnce();
  });
});
