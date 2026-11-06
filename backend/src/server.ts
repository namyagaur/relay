import "dotenv/config";
import type { Server } from "node:http";
import app from "./app";
import { prisma } from "./config/prisma";

const PORT = Number(process.env.PORT) || 3000;
const SHUTDOWN_TIMEOUT_MS = 10_000;

let server: Server | undefined;

export function createShutdownHandler(
  httpServer: Server,
  disconnectPrisma: () => Promise<void> = () => prisma.$disconnect()
) {
  let shutdownPromise: Promise<void> | undefined;

  return async function gracefulShutdown(signal: string): Promise<void> {
    if (shutdownPromise) {
      console.log(`Shutdown already in progress. Signal ${signal} ignored.`);
      return shutdownPromise;
    }

    console.log(`Received ${signal}. Shutting down HTTP server gracefully...`);

    shutdownPromise = (async () => {
      // 1. Stop accepting new connections and drain active requests
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          console.warn("Forcing HTTP server close after shutdown timeout.");
          resolve();
        }, SHUTDOWN_TIMEOUT_MS);
        timer.unref();

        httpServer.close((err) => {
          clearTimeout(timer);
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });

        if (typeof httpServer.closeIdleConnections === "function") {
          httpServer.closeIdleConnections();
        }
      });

      // 2. Disconnect Prisma
      console.log("Disconnecting Prisma Client...");
      await disconnectPrisma();
      console.log("Graceful shutdown complete.");
    })();

    try {
      await shutdownPromise;
    } catch (error) {
      console.error("Error during graceful shutdown:", error);
      throw error;
    }
  };
}

if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`Relay server running on port ${PORT}`);
  });

  const shutdown = createShutdownHandler(server);

  const onSignal = (signal: NodeJS.Signals): void => {
    void shutdown(signal)
      .catch(() => {
        process.exitCode = 1;
      })
      .finally(() => {
        process.off("SIGTERM", onSignal);
        process.off("SIGINT", onSignal);
      });
  };

  process.on("SIGTERM", onSignal);
  process.on("SIGINT", onSignal);
}

export { server };
export default app;
