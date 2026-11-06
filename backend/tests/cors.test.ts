import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app";
import { isOriginAllowed, getAllowedOrigins } from "../src/config/cors";

describe("CORS Configuration", () => {
  it("allows non-browser requests without an Origin header", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows requests from localhost in non-production environments", () => {
    const env = { NODE_ENV: "development" };
    expect(isOriginAllowed("http://localhost:5173", env)).toBe(true);
    expect(isOriginAllowed("http://127.0.0.1:5173", env)).toBe(true);
    expect(isOriginAllowed("http://localhost:3000", env)).toBe(true);
  });

  it("rejects unconfigured origins in production", () => {
    const env = {
      NODE_ENV: "production",
      FRONTEND_URL: "https://relay.vercel.app"
    };
    expect(isOriginAllowed("http://localhost:5173", env)).toBe(false);
    expect(isOriginAllowed("https://malicious-site.com", env)).toBe(false);
    expect(isOriginAllowed("https://relay.vercel.app", env)).toBe(true);
  });

  it("parses multiple comma-separated origins from ALLOWED_ORIGINS and FRONTEND_URL", () => {
    const env = {
      FRONTEND_URL: "https://relay.vercel.app/",
      ALLOWED_ORIGINS: "https://staging.relay.app, https://preview.relay.app"
    };
    const origins = getAllowedOrigins(env);
    expect(origins).toEqual([
      "https://relay.vercel.app",
      "https://staging.relay.app",
      "https://preview.relay.app"
    ]);
  });

  it("reflects Access-Control-Allow-Origin header when origin is allowed", async () => {
    const response = await request(app)
      .get("/health")
      .set("Origin", "http://localhost:5173");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });
});

