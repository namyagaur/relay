function positiveInteger(name: string, value: string | undefined, defaultValue: number): number {
  if (value === undefined || value === "") return defaultValue;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`${name} must be a positive integer.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`${name} must be a safe positive integer.`);
  }
  return parsed;
}

export function getDeliveryConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    requestTimeoutMs: positiveInteger("WEBHOOK_REQUEST_TIMEOUT_MS", env.WEBHOOK_REQUEST_TIMEOUT_MS, 10_000),
    concurrency: positiveInteger("DELIVERY_WORKER_CONCURRENCY", env.DELIVERY_WORKER_CONCURRENCY, 5)
  };
}
