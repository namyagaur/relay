import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import https from "node:https";
import ipaddr from "ipaddr.js";

export interface ValidatedWebhookTarget {
  url: string;
  hostname: string;
  addresses: Array<{ address: string; family: 4 | 6 }>;
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "metadata.azure.internal",
  "instance-data"
]);
const BLOCKED_ADDRESSES = new Set(["168.63.129.16"]);

function isPublicAddress(address: string): boolean {
  try {
    return !BLOCKED_ADDRESSES.has(address) && ipaddr.parse(address).range() === "unicast";
  } catch {
    return false;
  }
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return BLOCKED_HOSTNAMES.has(normalized)
    || [".localhost", ".local", ".internal", ".test", ".invalid", ".example"].some((suffix) => normalized.endsWith(suffix));
}

export async function validateWebhookUrl(
  input: string,
  resolve: typeof lookup = lookup
): Promise<ValidatedWebhookTarget> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("URL must be an absolute HTTPS URL.");
  }

  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.hash
    || (url.port && url.port !== "443")
    || !url.hostname
    || isBlockedHostname(url.hostname)
  ) {
    throw new Error("URL must use HTTPS and point to a public destination.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const literalFamily = isIP(hostname);
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = literalFamily
      ? [{ address: hostname, family: literalFamily }]
      : await resolve(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("URL could not be resolved to a public destination.");
  }

  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("URL must resolve exclusively to public IP addresses.");
  }

  url.hostname = hostname;
  return {
    url: url.toString(),
    hostname,
    addresses: addresses.map(({ address, family }) => ({ address, family: family as 4 | 6 }))
  };
}

export function createPinnedHttpsAgent(target: ValidatedWebhookTarget): https.Agent {
  const url = new URL(target.url);
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.hash
    || (url.port && url.port !== "443")
    || url.hostname.replace(/^\[|\]$/g, "").toLowerCase() !== target.hostname.toLowerCase()
    || isBlockedHostname(url.hostname)
    || target.addresses.length === 0
    || target.addresses.some(({ address, family }) => !isPublicAddress(address) || isIP(address) !== family)
  ) {
    throw new Error("Cannot create a pinned HTTPS agent for an unvalidated destination.");
  }

  const hostname = target.hostname.toLowerCase();
  const addresses = target.addresses.map(({ address, family }) => ({ address, family }));
  let nextAddress = 0;
  return new https.Agent({
    keepAlive: false,
    lookup: (lookupHostname, options, callback) => {
      if (lookupHostname.toLowerCase() !== hostname) {
        callback(new Error("Pinned HTTPS agent cannot connect to a different hostname."), "", 0);
        return;
      }
      const address = addresses[nextAddress++ % addresses.length];
      if (typeof options === "object" && "all" in options && options.all) {
        callback(null, [address]);
      } else {
        callback(null, address.address, address.family);
      }
    }
  });
}
