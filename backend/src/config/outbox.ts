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

export function getOutboxConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    pollIntervalMs: positiveInteger("OUTBOX_POLL_INTERVAL_MS", env.OUTBOX_POLL_INTERVAL_MS, 1000),
    batchSize: positiveInteger("OUTBOX_BATCH_SIZE", env.OUTBOX_BATCH_SIZE, 100)
  };
}
