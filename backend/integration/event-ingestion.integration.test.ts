
import "dotenv/config";
import { createHmac, randomUUID } from "node:crypto";
import { request as httpRequest, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { WebhookSender } from "../src/services/webhook-delivery";
import type { ValidatedWebhookTarget } from "../src/services/webhook-url";
import { encryptEndpointSecret } from "../src/utils/endpoint-secret";

type FindUnpublished =
  (typeof import("../src/services/outbox-repository"))["findUnpublishedOutboxMessages"];

type PersistDeliveryAttempt =
  (typeof import("../src/services/delivery-repository"))["persistDeliveryAttempt"];

type PrismaClient = (typeof import("../src/config/prisma"))["prisma"];

type IngestEvent =
  (typeof import("../src/services/event-service"))["ingestEvent"];
type CreateReplayRequest =
  (typeof import("../src/services/replay-service"))["createReplayRequest"];

let prisma: PrismaClient;
let ingestEvent: IngestEvent;
let findUnpublishedOutboxMessages: FindUnpublished;
let persistDeliveryAttempt: PersistDeliveryAttempt;
let createReplayRequest: CreateReplayRequest;

const projectIds = new Set<string>();

async function createTestProject(label: string) {
  const project = await prisma.project.create({
    data: { name: `relay-integration-${label}-${randomUUID()}` }
  });

  projectIds.add(project.id);
  return project;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required to run npm run test:integration."
    );
  }
  const databaseHostname = new URL(process.env.DATABASE_URL).hostname
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
  if (
    process.env.RELAY_TEST_DATABASE !== "local" ||
    !["localhost", "127.0.0.1", "::1"].includes(databaseHostname)
  ) {
    throw new Error(
      "Integration tests require RELAY_TEST_DATABASE=local and a loopback DATABASE_URL."
    );
  }

  ({ prisma } = await import("../src/config/prisma"));

  ({ ingestEvent } = await import("../src/services/event-service"));

  ({ findUnpublishedOutboxMessages } = await import(
    "../src/services/outbox-repository"
  ));

  ({ persistDeliveryAttempt } = await import(
    "../src/services/delivery-repository"
  ));
  ({ createReplayRequest } = await import("../src/services/replay-service"));
});

afterAll(async () => {
  if (!prisma) return;

  try {
    const ids = [...projectIds];

    if (ids.length > 0) {
      await prisma.outboxMessage.deleteMany({
        where: { event: { projectId: { in: ids } } }
      });

      await prisma.deliveryAttempt.deleteMany({
        where: { event: { projectId: { in: ids } } }
      });

      await prisma.event.deleteMany({
        where: { projectId: { in: ids } }
      });

      await prisma.apiKey.deleteMany({
        where: { projectId: { in: ids } }
      });

      await prisma.project.deleteMany({
        where: { id: { in: ids } }
      });
    }
  } finally {
    await prisma.$disconnect();
  }
});

describe("event ingestion PostgreSQL integration", () => {
  it(
    "persists events and outbox messages atomically with project-scoped idempotency",
    async () => {
      const firstProject = await createTestProject("first");
      const idempotencyKey = `idem-${randomUUID()}`;

      const input = {
        eventType: "invoice.paid",
        payload: { invoiceId: "inv_123" },
        idempotencyKey
      };

      const created = await ingestEvent(firstProject.id, input);
      expect(created.duplicate).toBe(false);

      const storedEvent = await prisma.event.findUnique({
        where: { id: created.event.id }
      });

      const storedOutbox = await prisma.outboxMessage.findUnique({
        where: { eventId: created.event.id }
      });

      expect(storedEvent).toMatchObject({
        projectId: firstProject.id,
        eventType: input.eventType,
        status: "pending"
      });

      expect(storedOutbox).toMatchObject({
        eventId: created.event.id,
        eventType: input.eventType,
        payload: input.payload
      });

      const duplicate = await ingestEvent(firstProject.id, input);

      expect(duplicate).toMatchObject({
        duplicate: true,
        event: { id: created.event.id }
      });

      expect(
        await prisma.outboxMessage.count({
          where: { eventId: created.event.id }
        })
      ).toBe(1);

      const secondProject = await createTestProject("second");

      const reusedKey = await ingestEvent(secondProject.id, input);

      expect(reusedKey).toMatchObject({
        duplicate: false,
        event: { projectId: secondProject.id }
      });

      expect(reusedKey.event.id).not.toBe(created.event.id);

      const withoutKeyOne = await ingestEvent(firstProject.id, {
        eventType: "invoice.created",
        payload: { invoiceId: "inv_124" }
      });

      const withoutKeyTwo = await ingestEvent(firstProject.id, {
        eventType: "invoice.created",
        payload: { invoiceId: "inv_124" }
      });

      expect(withoutKeyOne.duplicate).toBe(false);
      expect(withoutKeyTwo.duplicate).toBe(false);
      expect(withoutKeyOne.event.id).not.toBe(withoutKeyTwo.event.id);
    },
    20_000
  );

  it("rolls back an event when its outbox insert fails inside the transaction", async () => {
    const project = await createTestProject("rollback");
    const eventType = `rollback-${randomUUID()}`;

    await expect(
      prisma.$transaction(async (transaction) => {
        const event = await transaction.event.create({
          data: {
            projectId: project.id,
            eventType,
            payload: { test: "rollback" },
            status: "pending"
          }
        });

        await transaction.outboxMessage.create({
          data: {
            eventId: randomUUID(),
            eventType: event.eventType,
            payload: { test: "rollback" }
          }
        });
      })
    ).rejects.toThrow();

    expect(
      await prisma.event.count({
        where: { projectId: project.id, eventType }
      })
    ).toBe(0);
  });

  it(
    "keeps delivery targets immutable across repeated dispatch scans",
    async () => {
      const project = await createTestProject("snapshot");

      const firstEndpoint = await prisma.endpoint.create({
        data: {
          projectId: project.id,
          url: "https://example.com/webhook-one",
          encryptedSecret: encryptEndpointSecret(
            "test-signing-secret-one"
          )
        }
      });

      const created = await ingestEvent(project.id, {
        eventType: "invoice.paid",
        payload: { invoiceId: "inv_snapshot" }
      });

      const firstScan = await findUnpublishedOutboxMessages(1000);

      const firstMessage = firstScan.find(
        (message) => message.eventId === created.event.id
      );

      expect(
        firstMessage?.event.project.endpoints.map(
          (endpoint) => endpoint.id
        )
      ).toEqual([firstEndpoint.id]);

      const secondEndpoint = await prisma.endpoint.create({
        data: {
          projectId: project.id,
          url: "https://example.com/webhook-two",
          encryptedSecret: encryptEndpointSecret(
            "test-signing-secret-two"
          )
        }
      });

      const secondScan = await findUnpublishedOutboxMessages(1000);

      const secondMessage = secondScan.find(
        (message) => message.eventId === created.event.id
      );

      expect(
        secondMessage?.event.project.endpoints.map(
          (endpoint) => endpoint.id
        )
      ).toEqual([firstEndpoint.id]);

      expect(
        secondMessage?.event.project.endpoints.map(
          (endpoint) => endpoint.id
        )
      ).not.toContain(secondEndpoint.id);

      expect(
        await prisma.deliveryTarget.count({
          where: { eventId: created.event.id }
        })
      ).toBe(1);
    },
    20_000
  );

  it(
    "marks events skipped when their snapshot contains zero endpoints",
    async () => {
      const project = await createTestProject("zero-targets");

      const created = await ingestEvent(project.id, {
        eventType: "invoice.created",
        payload: { invoiceId: "inv_no_targets" }
      });

      const messages = await findUnpublishedOutboxMessages(1000);

      const message = messages.find(
        (item) => item.eventId === created.event.id
      );

      expect(message).toBeDefined();
      expect(message?.event.project.endpoints).toHaveLength(0);

      const storedOutbox = await prisma.outboxMessage.findUnique({
        where: { eventId: created.event.id }
      });

      expect(storedOutbox?.targetsSnapshottedAt).toBeInstanceOf(Date);

      const { publishWithoutEndpoints } = await import(
        "../src/services/outbox-repository"
      );

      const published = await publishWithoutEndpoints(
        message!.id,
        created.event.id,
        project.id,
        new Date()
      );

      expect(published).toBe(true);

      const [storedEventAfter, storedOutboxAfter] = await Promise.all([
        prisma.event.findUnique({
          where: { id: created.event.id }
        }),
        prisma.outboxMessage.findUnique({
          where: { eventId: created.event.id }
        })
      ]);

      expect(storedEventAfter?.status).toBe("skipped");
      expect(storedOutboxAfter?.publishedAt).toBeInstanceOf(Date);
    },
    20_000
  );

  it(
    "creates one consistent target snapshot under concurrent dispatcher scans",
    async () => {
      const project = await createTestProject("concurrent-snapshot");

      const endpoint = await prisma.endpoint.create({
        data: {
          projectId: project.id,
          url: "https://example.com/concurrent",
          encryptedSecret: encryptEndpointSecret(
            "concurrent-test-secret"
          )
        }
      });

      const created = await ingestEvent(project.id, {
        eventType: "invoice.created",
        payload: { invoiceId: "inv_concurrent" }
      });

      const [firstScan, secondScan] = await Promise.all([
        findUnpublishedOutboxMessages(1000),
        findUnpublishedOutboxMessages(1000)
      ]);

      const concurrentMessages = [...firstScan, ...secondScan].filter(
        (item) => item.eventId === created.event.id
      );

      expect(concurrentMessages.length).toBeGreaterThanOrEqual(1);

      for (const message of concurrentMessages) {
        expect(
          message.event.project.endpoints.map((item) => item.id)
        ).toEqual([endpoint.id]);
      }

      const subsequentScan = await findUnpublishedOutboxMessages(1000);

      const subsequentMessage = subsequentScan.find(
        (item) => item.eventId === created.event.id
      );

      expect(
        subsequentMessage?.event.project.endpoints.map(
          (item) => item.id
        )
      ).toEqual([endpoint.id]);

      expect(
        await prisma.deliveryTarget.count({
          where: { eventId: created.event.id }
        })
      ).toBe(1);

      expect(
        await prisma.outboxMessage.findUnique({
          where: { eventId: created.event.id }
        })
      ).toMatchObject({
        targetsSnapshottedAt: expect.any(Date),
        publishedAt: null
      });
    },
    20_000
  );
  it(
  "persists a successful delivery attempt and marks the event delivered",
  async () => {
    const project = await createTestProject("delivery-success");

    const endpoint = await prisma.endpoint.create({
      data: {
        projectId: project.id,
        url: "https://example.com/success",
        encryptedSecret: encryptEndpointSecret("success-test-secret")
      }
    });

    const created = await ingestEvent(project.id, {
      eventType: "invoice.paid",
      payload: { invoiceId: "inv_success" }
    });

    // Create the immutable target snapshot.
    await findUnpublishedOutboxMessages(1000);

    await persistDeliveryAttempt({
      eventId: created.event.id,
      projectId: project.id,
      endpointId: endpoint.id,
      status: "delivered",
      responseStatusCode: 200,
      responseBody: "OK",
      errorMessage: null,
      durationMs: 120,
      attemptedAt: new Date()
    });

    const [storedEvent, attempts] = await Promise.all([
      prisma.event.findUnique({
        where: { id: created.event.id }
      }),
      prisma.deliveryAttempt.findMany({
        where: { eventId: created.event.id }
      })
    ]);

    expect(storedEvent?.status).toBe("delivered");
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      endpointId: endpoint.id,
      attemptNumber: 1,
      status: "delivered",
      responseStatusCode: 200,
      responseBody: "OK"
    });
  },
  20_000
);
it(
  "persists a skipped delivery when the endpoint becomes inactive",
  async () => {
    const project = await createTestProject("delivery-skipped");

    const endpoint = await prisma.endpoint.create({
      data: {
        projectId: project.id,
        url: "https://example.com/skipped",
        encryptedSecret: encryptEndpointSecret("skipped-test-secret")
      }
    });

    const created = await ingestEvent(project.id, {
      eventType: "invoice.paid",
      payload: { invoiceId: "inv_skipped" }
    });

    // Snapshot the endpoint as an immutable delivery target.
    await findUnpublishedOutboxMessages(1000);

    // Deactivate the endpoint after the snapshot.
    await prisma.endpoint.update({
      where: { id: endpoint.id },
      data: { isActive: false }
    });

    await persistDeliveryAttempt({
      eventId: created.event.id,
      projectId: project.id,
      endpointId: endpoint.id,
      status: "skipped",
      responseStatusCode: null,
      responseBody: null,
      errorMessage: "Endpoint is inactive",
      durationMs: 0,
      attemptedAt: new Date()
    });

    const [storedEvent, attempts] = await Promise.all([
      prisma.event.findUnique({
        where: { id: created.event.id }
      }),
      prisma.deliveryAttempt.findMany({
        where: { eventId: created.event.id }
      })
    ]);

    expect(storedEvent?.status).toBe("skipped");
    expect(attempts).toHaveLength(1);
    expect(attempts[0]).toMatchObject({
      endpointId: endpoint.id,
      attemptNumber: 1,
      status: "skipped",
      errorMessage: "Endpoint is inactive"
    });
  },
  20_000
);
it(
  "serializes concurrent delivery attempts and assigns unique attempt numbers",
  async () => {
    const project = await createTestProject("delivery-concurrent");

    const endpoint = await prisma.endpoint.create({
      data: {
        projectId: project.id,
        url: "https://example.com/concurrent",
        encryptedSecret: encryptEndpointSecret("concurrent-test-secret")
      }
    });

    const created = await ingestEvent(project.id, {
      eventType: "invoice.paid",
      payload: { invoiceId: "inv_concurrent" }
    });

    // Snapshot the endpoint as a delivery target.
    await findUnpublishedOutboxMessages(1000);

    const makeAttempt = (attemptedAt: Date) =>
      persistDeliveryAttempt({
        eventId: created.event.id,
        projectId: project.id,
        endpointId: endpoint.id,
        status: "retrying",
        responseStatusCode: 503,
        responseBody: "Service unavailable",
        errorMessage: "Temporary failure",
        durationMs: 100,
        attemptedAt
      });

    // Both attempts execute concurrently against PostgreSQL.
    await Promise.all([
      makeAttempt(new Date("2026-11-06T10:00:00.000Z")),
      makeAttempt(new Date("2026-11-06T10:00:01.000Z"))
    ]);

    const attempts = await prisma.deliveryAttempt.findMany({
      where: {
        eventId: created.event.id,
        endpointId: endpoint.id
      },
      orderBy: { attemptNumber: "asc" }
    });

    const storedEvent = await prisma.event.findUnique({
      where: { id: created.event.id }
    });

    expect(attempts).toHaveLength(2);
    expect(attempts.map((attempt) => attempt.attemptNumber)).toEqual([1, 2]);
    expect(attempts.every((attempt) => attempt.status === "retrying")).toBe(true);
    expect(storedEvent?.status).toBe("processing");
  },
  20_000
);
it(
  "persists multiple replay requests against the original event and target snapshot",
  async () => {
    const project = await createTestProject("replay-persistence");
    const endpoint = await prisma.endpoint.create({
      data: {
        projectId: project.id,
        url: "https://example.com/replay",
        encryptedSecret: encryptEndpointSecret("replay-test-secret")
      }
    });
    const created = await ingestEvent(project.id, {
      eventType: "invoice.paid",
      payload: { invoiceId: "inv_replay" }
    });

    await prisma.deliveryTarget.create({
      data: { eventId: created.event.id, endpointId: endpoint.id }
    });
    await prisma.outboxMessage.update({
      where: { eventId: created.event.id },
      data: { targetsSnapshottedAt: new Date() }
    });

    const startedAt = new Date();
    await prisma.replayRequest.createMany({
      data: [
        { eventId: created.event.id, status: "pending" },
        { eventId: created.event.id, status: "processing", startedAt }
      ]
    });

    const storedEvent = await prisma.event.findUnique({
      where: { id: created.event.id },
      select: {
        projectId: true,
        eventType: true,
        payload: true,
        deliveryTargets: { select: { endpointId: true } },
        replayRequests: {
          select: { eventId: true, status: true, startedAt: true, createdAt: true }
        }
      }
    });

    expect(storedEvent).toMatchObject({
      projectId: project.id,
      eventType: "invoice.paid",
      payload: { invoiceId: "inv_replay" },
      deliveryTargets: [{ endpointId: endpoint.id }]
    });
    expect(storedEvent?.replayRequests).toHaveLength(2);
    expect(storedEvent?.replayRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventId: created.event.id, status: "pending", startedAt: null }),
      expect.objectContaining({ eventId: created.event.id, status: "processing", startedAt })
    ]));
    expect(storedEvent?.replayRequests.every((request) => request.createdAt instanceof Date)).toBe(true);
  },
  20_000
);
it(
  "creates multiple replay requests and persists replay attempts without changing original event history",
  async () => {
    const project = await createTestProject("replay-execution");
    const endpoint = await prisma.endpoint.create({
      data: {
        projectId: project.id,
        url: "https://example.com/replay-execution",
        encryptedSecret: encryptEndpointSecret("replay-execution-secret")
      }
    });
    const created = await ingestEvent(project.id, {
      eventType: "invoice.paid",
      payload: { invoiceId: "inv_replay_execution" }
    });
    await prisma.deliveryTarget.create({
      data: { eventId: created.event.id, endpointId: endpoint.id }
    });
    await prisma.outboxMessage.update({
      where: { eventId: created.event.id },
      data: { targetsSnapshottedAt: new Date() }
    });
    await persistDeliveryAttempt({
      eventId: created.event.id,
      projectId: project.id,
      endpointId: endpoint.id,
      status: "failed",
      responseStatusCode: 503,
      responseBody: "Unavailable",
      errorMessage: "Temporary failure exhausted",
      durationMs: 100,
      attemptedAt: new Date("2026-11-06T00:00:00Z")
    });

    const first = await createReplayRequest(project.id, created.event.id);
    const second = await createReplayRequest(project.id, created.event.id);
    expect(first.kind).toBe("created");
    expect(second.kind).toBe("created");
    if (first.kind !== "created" || second.kind !== "created") return;

    await persistDeliveryAttempt({
      eventId: created.event.id,
      projectId: project.id,
      endpointId: endpoint.id,
      replayRequestId: first.replayRequest.id,
      status: "delivered",
      responseStatusCode: 204,
      responseBody: "",
      errorMessage: null,
      durationMs: 25,
      attemptedAt: new Date("2026-11-06T00:01:00Z")
    });

    const [storedEvent, firstRequest, attempts] = await Promise.all([
      prisma.event.findUnique({ where: { id: created.event.id } }),
      prisma.replayRequest.findUnique({
        where: { id: first.replayRequest.id },
        include: { targets: true }
      }),
      prisma.deliveryAttempt.findMany({
        where: { eventId: created.event.id },
        orderBy: { attemptNumber: "asc" }
      })
    ]);

    expect(storedEvent?.status).toBe("failed");
    expect(firstRequest).toMatchObject({
      status: "completed",
      targets: [{ endpointId: endpoint.id, status: "completed" }]
    });
    expect(attempts).toHaveLength(2);
    expect(attempts.map((attempt) => attempt.replayRequestId)).toEqual([
      null,
      first.replayRequest.id
    ]);
    expect(second.replayRequest.id).not.toBe(first.replayRequest.id);
  },
  20_000
);

it(
  "automatically publishes pending outbox messages through the polling dispatcher",
  async () => {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("A local REDIS_URL is required for outbox polling integration.");
    }
    const redisAddress = new URL(redisUrl);
    const redisHostname = redisAddress.hostname.replace(/^\[|\]$/g, "").toLowerCase();
    if (!["localhost", "127.0.0.1", "::1"].includes(redisHostname)) {
      throw new Error("Outbox polling integration requires loopback Redis.");
    }

    const [{ QueueEvents }, { createDeliveryQueue }, { startOutboxDispatcher }] =
      await Promise.all([
        import("bullmq"),
        import("../src/queue/delivery-queue"),
        import("../src/workers/outbox-dispatcher")
      ]);
    const queueName = `relay-outbox-polling-test-${randomUUID()}`;
    const redisPort = Number(redisAddress.port || 6379);
    const queueEvents = new QueueEvents(queueName, {
      connection: {
        host: redisHostname,
        port: redisPort,
        maxRetriesPerRequest: null
      }
    });
    const deliveryQueue = createDeliveryQueue(redisUrl, queueName);
    let dispatcher: ReturnType<typeof startOutboxDispatcher> | undefined;
    let dispatchErrors = 0;

    try {
      await Promise.all([
        queueEvents.waitUntilReady(),
        deliveryQueue.queue.waitUntilReady()
      ]);

      const project = await createTestProject("outbox-polling");
      const endpoint = await prisma.endpoint.create({
        data: {
          projectId: project.id,
          url: "https://example.com/outbox-polling",
          encryptedSecret: encryptEndpointSecret("outbox-polling-secret")
        }
      });
      const created = await ingestEvent(project.id, {
        eventType: "invoice.paid",
        payload: { invoiceId: "inv_outbox_polling" }
      });
      const outboxBeforeDispatch = await prisma.outboxMessage.findUnique({
        where: { eventId: created.event.id }
      });
      expect(outboxBeforeDispatch).toMatchObject({
        eventId: created.event.id,
        publishedAt: null,
        targetsSnapshottedAt: null
      });
      if (!outboxBeforeDispatch) throw new Error("Ingested event has no outbox message.");

      const jobId = `delivery-${created.event.id}-${endpoint.id}`;
      const waitingForJob = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          queueEvents.off("waiting", onWaiting);
          reject(new Error("Polling dispatcher did not publish the delivery job."));
        }, 10_000);
        const onWaiting = ({ jobId: waitingJobId }: { jobId: string }) => {
          if (waitingJobId !== jobId) return;
          clearTimeout(timeout);
          queueEvents.off("waiting", onWaiting);
          resolve();
        };
        queueEvents.on("waiting", onWaiting);
      });

      dispatcher = startOutboxDispatcher({
        queue: deliveryQueue.queue,
        pollIntervalMs: 100,
        batchSize: 10,
        onDispatchError: () => { dispatchErrors += 1; }
      });

      await waitingForJob;

      const publicationDeadline = Date.now() + 5_000;
      let outboxAfterDispatch = await prisma.outboxMessage.findUnique({
        where: { eventId: created.event.id }
      });
      while (!outboxAfterDispatch?.publishedAt && Date.now() < publicationDeadline) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        outboxAfterDispatch = await prisma.outboxMessage.findUnique({
          where: { eventId: created.event.id }
        });
      }

      expect(outboxAfterDispatch).toMatchObject({
        id: outboxBeforeDispatch.id,
        targetsSnapshottedAt: expect.any(Date),
        publishedAt: expect.any(Date)
      });
      const job = await deliveryQueue.queue.getJob(jobId);
      expect(job).toBeDefined();
      expect(job?.data).toMatchObject({
        eventId: created.event.id,
        projectId: project.id,
        endpointId: endpoint.id
      });
      expect(await job?.getState()).toBe("waiting");
      expect(dispatchErrors).toBe(0);
    } finally {
      try {
        if (dispatcher) await dispatcher.close();
      } finally {
        try {
          await queueEvents.close();
        } finally {
          try {
            await deliveryQueue.queue.obliterate({ force: true });
          } finally {
            await deliveryQueue.close();
          }
        }
      }
    }
  },
  30_000
);

it(
  "retries real webhook HTTP delivery through the queue until the receiver succeeds",
  async () => {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error(
        "A local REDIS_URL is required to run the real webhook retry integration test."
      );
    }
    const redisHostname = new URL(redisUrl).hostname
      .replace(/^\[|\]$/g, "")
      .toLowerCase();
    if (!["localhost", "127.0.0.1", "::1"].includes(redisHostname)) {
      throw new Error(
        "The webhook retry integration test requires a loopback Redis instance."
      );
    }

    const signingSecret = "retry-integration-secret";
    const payload = { invoiceId: "inv_retry_lifecycle" };
    const receivedRequests: Array<{
      rawBody: string;
      signature: string | undefined;
    }> = [];
    const responseStatuses: number[] = [];
    const receiver = createServer((request, response) => {
      if (request.method !== "POST" || request.url !== "/webhook") {
        response.writeHead(404).end();
        return;
      }

      const chunks: Buffer[] = [];
      request.on("data", (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      request.on("end", () => {
        const rawBody = Buffer.concat(chunks).toString("utf8");
        const signature = request.headers["x-relay-signature"];
        receivedRequests.push({
          rawBody,
          signature: Array.isArray(signature) ? signature[0] : signature
        });
        const statusCode = receivedRequests.length < 3 ? 500 : 200;
        responseStatuses.push(statusCode);
        response.writeHead(statusCode, { "content-type": "text/plain" });
        response.end(statusCode === 200 ? "ok" : "retry");
      });
    });

    let deliveryQueue:
      | ReturnType<(typeof import("../src/queue/delivery-queue"))["createDeliveryQueue"]>
      | undefined;
    let deliveryWorker:
      | ReturnType<(typeof import("../src/queue/delivery-queue"))["createDeliveryWorker"]>
      | undefined;
    let jobId: string | undefined;

    try {
      await new Promise<void>((resolve, reject) => {
        receiver.once("error", reject);
        receiver.listen(0, "127.0.0.1", resolve);
      });
      const listeningAddress = receiver.address();
      if (!listeningAddress || typeof listeningAddress === "string") {
        throw new Error("Could not determine the local webhook receiver port.");
      }
      const address: AddressInfo = listeningAddress;

      const { createDeliveryQueue, createDeliveryWorker } =
        await import("../src/queue/delivery-queue");
      const { dispatchOutboxBatch } = await import("../src/services/outbox-dispatcher");
      const { markOutboxMessagePublished, publishWithoutEndpoints } =
        await import("../src/services/outbox-repository");
      const testQueueName = `relay-webhook-deliveries-test-${randomUUID()}`;

      const endpointUrl = `http://127.0.0.1:${address.port}/webhook`;
      const validateLocalTarget = async (input: string): Promise<ValidatedWebhookTarget> => {
        const url = new URL(input);
        if (url.toString() !== endpointUrl) {
          throw new Error("Unexpected webhook target in retry integration test.");
        }
        return {
          url: url.toString(),
          hostname: "127.0.0.1",
          addresses: [{ address: "127.0.0.1", family: 4 }]
        };
      };
      const sendLocalHttp: WebhookSender = (target, body, headers, timeoutMs) =>
        new Promise((resolve, reject) => {
          const request = httpRequest(target.url, {
            method: "POST",
            headers: {
              ...headers,
              "content-type": "application/json",
              "content-length": Buffer.byteLength(body).toString()
            },
            timeout: timeoutMs
          }, (response) => {
            const chunks: Buffer[] = [];
            response.on("data", (chunk: Buffer | string) => {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            response.on("error", reject);
            response.on("end", () => resolve({
              statusCode: response.statusCode ?? 0,
              responseBody: Buffer.concat(chunks).toString("utf8")
            }));
          });
          request.on("timeout", () => request.destroy(new Error("Webhook request timed out.")));
          request.on("error", reject);
          request.end(body);
        });

      const activeQueue = deliveryQueue = createDeliveryQueue(redisUrl, testQueueName);
      await activeQueue.queue.waitUntilReady();

      const project = await createTestProject("http-retry-lifecycle");
      const endpoint = await prisma.endpoint.create({
        data: {
          projectId: project.id,
          url: endpointUrl,
          encryptedSecret: encryptEndpointSecret(signingSecret)
        }
      });
      const created = await ingestEvent(project.id, {
        eventType: "invoice.paid",
        payload
      });
      const [storedEventBeforeDispatch, outboxBeforeDispatch] = await Promise.all([
        prisma.event.findUnique({ where: { id: created.event.id } }),
        prisma.outboxMessage.findUnique({ where: { eventId: created.event.id } })
      ]);
      expect(storedEventBeforeDispatch).toMatchObject({
        id: created.event.id,
        projectId: project.id,
        status: "pending",
        payload
      });
      expect(outboxBeforeDispatch).toMatchObject({
        eventId: created.event.id,
        eventType: "invoice.paid",
        payload,
        publishedAt: null,
        targetsSnapshottedAt: null
      });
      if (!outboxBeforeDispatch) throw new Error("Ingested event has no outbox message.");
      jobId = `delivery-${created.event.id}-${endpoint.id}`;

      const dispatchResult = await dispatchOutboxBatch({
        repository: {
          findUnpublished: async (batchSize) =>
            (await findUnpublishedOutboxMessages(batchSize))
              .filter((message) => message.eventId === created.event.id),
          publishWithoutEndpoints,
          markPublished: markOutboxMessagePublished
        },
        queue: activeQueue.queue,
        batchSize: 1000
      });
      expect(dispatchResult).toEqual({
        messagesFound: 1,
        messagesPublished: 1,
        messagesFailed: 0,
        jobsEnqueued: 1
      });

      const [storedOutboxAfterDispatch, queuedJob] = await Promise.all([
        prisma.outboxMessage.findUnique({ where: { eventId: created.event.id } }),
        activeQueue.queue.getJob(jobId)
      ]);
      expect(storedOutboxAfterDispatch).toMatchObject({
        id: outboxBeforeDispatch.id,
        targetsSnapshottedAt: expect.any(Date),
        publishedAt: expect.any(Date)
      });
      expect(queuedJob).toBeDefined();
      expect(queuedJob?.data).toMatchObject({
        outboxMessageId: outboxBeforeDispatch.id,
        eventId: created.event.id,
        projectId: project.id,
        endpointId: endpoint.id,
        endpointUrl,
        eventType: "invoice.paid",
        payload
      });
      expect(await queuedJob?.getState()).toBe("waiting");

      const activeWorker = deliveryWorker = createDeliveryWorker({
        redisUrl,
        requestTimeoutMs: 5_000,
        concurrency: 1,
        testQueueName,
        testDeliveryOverrides: {
          validateTarget: validateLocalTarget,
          send: sendLocalHttp
        }
      });
      await activeWorker.worker.waitUntilReady();

      const timeoutAt = Date.now() + 60_000;
      let storedEvent: Awaited<ReturnType<typeof prisma.event.findUnique>> = null;
      let attempts: Awaited<ReturnType<typeof prisma.deliveryAttempt.findMany>> = [];
      while (Date.now() < timeoutAt) {
        [storedEvent, attempts] = await Promise.all([
          prisma.event.findUnique({ where: { id: created.event.id } }),
          prisma.deliveryAttempt.findMany({
            where: { eventId: created.event.id, endpointId: endpoint.id },
            orderBy: { attemptNumber: "asc" }
          })
        ]);
        if (storedEvent?.status === "delivered" && attempts.length === 3) break;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      expect(receivedRequests).toHaveLength(3);
      expect(responseStatuses).toEqual([500, 500, 200]);
      expect(receivedRequests.map(({ rawBody }) => JSON.parse(rawBody))).toEqual([
        payload,
        payload,
        payload
      ]);
      expect(storedEvent).toMatchObject({
        id: created.event.id,
        projectId: project.id,
        eventType: "invoice.paid",
        payload,
        status: "delivered",
        createdAt: created.event.createdAt
      });
      expect(attempts).toHaveLength(3);
      expect(attempts.map((attempt) => ({
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        responseStatusCode: attempt.responseStatusCode,
        replayRequestId: attempt.replayRequestId
      }))).toEqual([
        { attemptNumber: 1, status: "retrying", responseStatusCode: 500, replayRequestId: null },
        { attemptNumber: 2, status: "retrying", responseStatusCode: 500, replayRequestId: null },
        { attemptNumber: 3, status: "delivered", responseStatusCode: 200, replayRequestId: null }
      ]);

      const verifySignature = (rawBody: string, signature: string | undefined): boolean => {
        const expected = `sha256=${createHmac("sha256", signingSecret)
          .update(rawBody, "utf8")
          .digest("hex")}`;
        return signature === expected;
      };
      for (const received of receivedRequests) {
        expect(received.signature).toMatch(/^sha256=[a-f0-9]{64}$/);
        expect(received.signature).toBe(
          `sha256=${createHmac("sha256", signingSecret)
            .update(received.rawBody, "utf8")
            .digest("hex")}`
        );
        expect(verifySignature(received.rawBody, received.signature)).toBe(true);
      }

      const modifiedPayloadBody = JSON.stringify({ ...payload, invoiceId: "modified" });
      expect(verifySignature(modifiedPayloadBody, receivedRequests[0].signature)).toBe(false);
    } finally {
      if (deliveryWorker) await deliveryWorker.close();
      if (deliveryQueue) {
        await deliveryQueue.queue.obliterate({ force: true });
        await deliveryQueue.close();
      }
      if (receiver.listening) {
        await new Promise<void>((resolve, reject) => {
          receiver.close((error) => error ? reject(error) : resolve());
        });
      }
    }
  },
  90_000
);
});
