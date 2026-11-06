import type { CorsOptions } from "cors";

const DEFAULT_DEV_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

export function getAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  const envSources = [env.FRONTEND_URL, env.ALLOWED_ORIGINS].filter(Boolean) as string[];
  const origins = envSources
    .flatMap((source) => source.split(","))
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter((origin) => origin.length > 0);

  return Array.from(new Set(origins));
}

export function isOriginAllowed(
  origin: string | undefined,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  // Allow non-browser requests (curl, server-to-server, supertest, etc.)
  if (!origin) {
    return true;
  }

  const normalizedOrigin = origin.trim().replace(/\/+$/, "");
  const allowedOrigins = getAllowedOrigins(env);

  // Exact match against configured origins
  if (allowedOrigins.some((allowed) => allowed.toLowerCase() === normalizedOrigin.toLowerCase())) {
    return true;
  }

  // Allow localhost/loopback in non-production environments
  const isProduction = env.NODE_ENV === "production";
  if (!isProduction && DEFAULT_DEV_ORIGIN_REGEX.test(normalizedOrigin)) {
    return true;
  }

  return false;
}

export function getCorsOptions(env: NodeJS.ProcessEnv = process.env): CorsOptions {
  return {
    origin(requestOrigin, callback) {
      if (isOriginAllowed(requestOrigin, env)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Requested-With"]
  };
}

