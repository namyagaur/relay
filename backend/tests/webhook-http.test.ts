import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  agentDestroy: vi.fn()
}));

vi.mock("node:https", () => ({
  default: { request: mocks.request }
}));

vi.mock("../src/services/webhook-url", () => ({
  createPinnedHttpsAgent: vi.fn(() => ({ destroy: mocks.agentDestroy }))
}));

import { sendWebhookRequest } from "../src/services/webhook-delivery";
import type { ValidatedWebhookTarget } from "../src/services/webhook-url";

const target: ValidatedWebhookTarget = {
  url: "https://hooks.example.org/path",
  hostname: "hooks.example.org",
  addresses: [{ address: "8.8.8.8", family: 4 }]
};

function createRequestHarness(options: { statusCode?: number; body?: string; respond?: boolean } = {}) {
  const request = new EventEmitter() as EventEmitter & {
    end: (body: string) => void;
    destroy: (error: Error) => void;
  };
  request.end = vi.fn((body: string) => {
    if (!options.respond) return;
    const response = new EventEmitter() as EventEmitter & { statusCode: number };
    response.statusCode = options.statusCode ?? 204;
    queueMicrotask(() => {
      mocks.request.mock.calls[0][2](response);
      if (options.body) response.emit("data", options.body);
      response.emit("end");
    });
    expect(body).toBe('{"ok":true}');
  });
  request.destroy = vi.fn((error: Error) => {
    queueMicrotask(() => request.emit("error", error));
  });
  mocks.request.mockReturnValue(request);
  return request;
}

describe("pinned HTTPS webhook requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses POST with the pinned agent and returns redirects without following them", async () => {
    createRequestHarness({ statusCode: 302, body: "redirect", respond: true });
    const result = await sendWebhookRequest(target, '{"ok":true}', {
      "x-relay-signature": "sha256=signature"
    }, 1000);

    expect(result).toEqual({ statusCode: 302, responseBody: "redirect" });
    expect(mocks.request).toHaveBeenCalledOnce();
    expect(mocks.request).toHaveBeenCalledWith(target.url, expect.objectContaining({
      method: "POST",
      agent: expect.any(Object),
      headers: expect.objectContaining({
        "content-type": "application/json",
        "x-relay-signature": "sha256=signature"
      })
    }), expect.any(Function));
    expect(mocks.agentDestroy).toHaveBeenCalledOnce();
  });

  it("enforces request timeout and bounds persisted response bodies", async () => {
    const timedOutRequest = createRequestHarness({ respond: false });
    await expect(sendWebhookRequest(target, '{"ok":true}', {}, 10)).rejects.toThrow("Webhook request failed.");
    expect(timedOutRequest.destroy).toHaveBeenCalledOnce();
    expect(mocks.agentDestroy).toHaveBeenCalledOnce();

    vi.clearAllMocks();
    createRequestHarness({ statusCode: 200, body: "a".repeat(20_000), respond: true });
    const result = await sendWebhookRequest(target, '{"ok":true}', {}, 1000);
    expect(Buffer.byteLength(result.responseBody)).toBe(10 * 1024);
  });
});
