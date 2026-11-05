import { describe, expect, it } from "vitest";
import { createPinnedHttpsAgent, validateWebhookUrl } from "../src/services/webhook-url";

describe("webhook URL validation", () => {
  it.each([
    "http://example.com/hook",
    "file:///etc/passwd",
    "https://localhost/hook",
    "https://metadata.google.internal/latest/meta-data",
    "https://127.0.0.1/hook",
    "https://[::1]/hook",
    "https://user:pass@example.com/hook",
    "https://example.com:8443/hook"
  ])("rejects unsafe URL %s", async (url) => {
    await expect(validateWebhookUrl(url)).rejects.toThrow();
  });

  it("rejects DNS answers containing private or reserved addresses", async () => {
    const resolve = async () => [{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 }];
    await expect(validateWebhookUrl("https://public.org/hook", resolve as never)).rejects.toThrow(/public IP/);
  });

  it("accepts public HTTPS destinations and pins the resolved addresses", async () => {
    const resolve = async () => [{ address: "8.8.8.8", family: 4 }, { address: "2001:4860:4860::8888", family: 6 }];
    const target = await validateWebhookUrl("https://hooks.example.org/path", resolve as never);
    expect(target.hostname).toBe("hooks.example.org");
    expect(target.addresses).toEqual([
      { address: "8.8.8.8", family: 4 },
      { address: "2001:4860:4860::8888", family: 6 }
    ]);
    const agent = createPinnedHttpsAgent(target);
    const lookup = agent.options.lookup;
    if (!lookup) throw new Error("Pinned agent must provide a lookup function.");
    const resolved = await new Promise<{ address: string; family?: number }>((resolveAddress, reject) => {
      lookup(target.hostname, {}, (error, address, family) => {
        if (error || typeof address !== "string") reject(error ?? new Error("Expected a pinned address."));
        else resolveAddress({ address, family });
      });
    });
    expect(resolved).toEqual({ address: "8.8.8.8", family: 4 });
    agent.destroy();
  });

  it("supports public IPv6 literals and refuses an agent used for another hostname", async () => {
    const target = await validateWebhookUrl("https://[2001:4860:4860::8888]/hook");
    expect(target.addresses).toEqual([{ address: "2001:4860:4860::8888", family: 6 }]);

    const agent = createPinnedHttpsAgent(target);
    const lookup = agent.options.lookup;
    if (!lookup) throw new Error("Pinned agent must provide a lookup function.");
    await expect(new Promise((resolve, reject) => {
      lookup("different.example", {}, (error) => error ? reject(error) : resolve(undefined));
    })).rejects.toThrow(/different hostname/);
    agent.destroy();
  });
});
