import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/config/prisma";

describe("Health and Readiness Endpoints", () => {
  it("returns 200 for liveness probe on /health and /health/live", async () => {
    const healthRes = await request(app).get("/health");
    expect(healthRes.status).toBe(200);
    expect(healthRes.body).toEqual({
      status: "ok",
      service: "relay"
    });

    const liveRes = await request(app).get("/health/live");
    expect(liveRes.status).toBe(200);
    expect(liveRes.body).toEqual({
      status: "ok",
      service: "relay"
    });
  });

  it("returns 200 ready when database connectivity check succeeds", async () => {
    const readyRes = await request(app).get("/health/ready");
    expect(readyRes.status).toBe(200);
    expect(readyRes.body).toEqual({
      status: "ready",
      service: "relay",
      checks: {
        database: "connected"
      }
    });
  });

  it("returns 503 unavailable when database connectivity check fails", async () => {
    const queryRawSpy = vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("Connection refused"));

    const readyRes = await request(app).get("/health/ready");
    expect(readyRes.status).toBe(503);
    expect(readyRes.body).toEqual({
      status: "unavailable",
      service: "relay",
      checks: {
        database: "disconnected"
      },
      error: "Database connectivity check failed."
    });

    queryRawSpy.mockRestore();
  });
});

