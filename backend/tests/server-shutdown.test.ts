import { describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import { createShutdownHandler } from "../src/server";

describe("API Graceful Shutdown", () => {
  it("closes the HTTP server and disconnects Prisma", async () => {
    let serverClosed = false;
    let prismaDisconnected = false;

    const mockServer = {
      close(callback?: (err?: Error) => void) {
        serverClosed = true;
        callback?.();
        return this;
      },
      closeIdleConnections: vi.fn()
    } as unknown as Server;

    const mockDisconnect = vi.fn(async () => {
      prismaDisconnected = true;
    });

    const shutdown = createShutdownHandler(mockServer, mockDisconnect);
    await shutdown("SIGTERM");

    expect(serverClosed).toBe(true);
    expect(prismaDisconnected).toBe(true);
  });

  it("handles duplicate shutdown calls safely without double-closing", async () => {
    let closeCallCount = 0;

    const mockServer = {
      close(callback?: (err?: Error) => void) {
        closeCallCount++;
        callback?.();
        return this;
      }
    } as unknown as Server;

    const mockDisconnect = vi.fn(async () => {});

    const shutdown = createShutdownHandler(mockServer, mockDisconnect);

    // Call twice concurrently
    await Promise.all([shutdown("SIGTERM"), shutdown("SIGINT")]);

    expect(closeCallCount).toBe(1);
    expect(mockDisconnect).toHaveBeenCalledTimes(1);
  });
});

