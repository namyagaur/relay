import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request, { type Test } from "supertest";

const mocks = vi.hoisted(() => ({
  apiKeyFindUnique: vi.fn(),
  apiKeyUpdateMany: vi.fn(),
  apiKeyCreate: vi.fn(),
  projectCreate: vi.fn(),
  endpointCreate: vi.fn(),
  endpointFindMany: vi.fn(),
  endpointFindFirst: vi.fn(),
  endpointUpdateMany: vi.fn(),
  endpointCount: vi.fn(),
  eventCreate: vi.fn(),
  eventGroupBy: vi.fn(),
  eventFindFirst: vi.fn(),
  eventFindMany: vi.fn(),
  eventFindUnique: vi.fn(),
  replayEventFindFirst: vi.fn(),
  replayAttemptFindMany: vi.fn(),
  replayRequestCreate: vi.fn(),
  replayQueryRaw: vi.fn(),
  deliveryAttemptFindFirst: vi.fn(),
  deliveryAttemptFindMany: vi.fn(),
  deliveryAttemptGroupBy: vi.fn(),
  outboxMessageCreate: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    apiKey: {
      findUnique: mocks.apiKeyFindUnique,
      updateMany: mocks.apiKeyUpdateMany,
      create: mocks.apiKeyCreate
    },
    project: { create: mocks.projectCreate },
    endpoint: {
      create: mocks.endpointCreate,
      findMany: mocks.endpointFindMany,
      count: mocks.endpointCount,
      findFirst: mocks.endpointFindFirst,
      updateMany: mocks.endpointUpdateMany
    },
    event: {
      create: mocks.eventCreate,
      groupBy: mocks.eventGroupBy,
      findFirst: mocks.eventFindFirst,
      findMany: mocks.eventFindMany,
      findUnique: mocks.eventFindUnique
    },
    deliveryAttempt: {
      findFirst: mocks.deliveryAttemptFindFirst,
      findMany: mocks.deliveryAttemptFindMany,
      groupBy: mocks.deliveryAttemptGroupBy
    },
    outboxMessage: { create: mocks.outboxMessageCreate },
    $transaction: mocks.transaction
  }
}));

vi.mock("../src/services/webhook-url", () => ({
  validateWebhookUrl: vi.fn(async (url: string) => ({
    url,
    hostname: new URL(url).hostname,
    addresses: [{ address: "8.8.8.8", family: 4 }]
  })),
  createPinnedHttpsAgent: vi.fn()
}));

import app from "../src/app";
import { hashApiKey } from "../src/utils/api-key";
import { decryptEndpointSecret } from "../src/utils/endpoint-secret";
import { validateWebhookUrl } from "../src/services/webhook-url";
import { openApiSpec } from "../src/docs/openapi";

const rawKey = `relay_${"a".repeat(43)}`;
const project = { id: "11111111-1111-4111-8111-111111111111", name: "test project" };
const endpoint = {
  id: "22222222-2222-4222-8222-222222222222",
  url: "https://hooks.example.com/relay",
  description: "test",
  isActive: true,
  deletedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z")
};
const event = {
  id: "44444444-4444-4444-8444-444444444444",
  projectId: project.id,
  idempotencyKey: "event-request-1",
  eventType: "invoice.paid",
  payload: { invoiceId: "inv_123" },
  status: "pending",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z")
};

beforeAll(() => {
  process.env.ENDPOINT_SECRET_ENCRYPTION_KEY = Buffer.alloc(32, 1).toString("base64");
});

function authenticate(req: Test): Test {
  mocks.apiKeyFindUnique.mockResolvedValue({
    id: "33333333-3333-4333-8333-333333333333",
    projectId: project.id,
    revokedAt: null,
    project
  });
  mocks.apiKeyUpdateMany.mockResolvedValue({ count: 1 });
  return req.set("Authorization", `Bearer ${rawKey}`);
}

describe("API key authentication and project management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([undefined, "Basic abc", "Bearer invalid", `Bearer ${"x".repeat(120)}`, `bearer RELAY_${"a".repeat(43)}`])(
    "rejects a missing or malformed authorization header: %s",
    async (authorization) => {
      let req = request(app).get("/api/v1/endpoints");
      if (authorization) req = req.set("Authorization", authorization);
      const response = await req;
      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
      expect(mocks.apiKeyFindUnique).not.toHaveBeenCalled();
    }
  );

  it("authenticates using only the API key hash and attaches project scope", async () => {
    mocks.endpointFindMany.mockResolvedValue([endpoint]);
    const response = await authenticate(request(app).get("/api/v1/endpoints/"));
    expect(response.status).toBe(200);
    expect(mocks.apiKeyFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { keyHash: hashApiKey(rawKey) }
    }));
    expect(mocks.endpointFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId: project.id, deletedAt: null }
    }));
    expect(JSON.stringify(response.body)).not.toContain(rawKey);
  });

  it.each(["Bearer", "bearer"])("accepts the %s authorization scheme", async (scheme) => {
    mocks.endpointFindMany.mockResolvedValue([endpoint]);

    const response = await request(app)
      .get("/api/v1/endpoints")
      .set("Authorization", `${scheme} ${rawKey}`);

    expect(response.status).toBe(200);
    expect(mocks.apiKeyFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { keyHash: hashApiKey(rawKey) }
    }));
  });

  it("rejects unknown and revoked API keys", async () => {
    mocks.apiKeyFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "33333333-3333-4333-8333-333333333333",
      projectId: project.id,
      revokedAt: new Date(),
      project
    });
    for (let index = 0; index < 2; index += 1) {
      const response = await request(app).get("/api/v1/endpoints").set("Authorization", `Bearer ${rawKey}`);
      expect(response.status).toBe(401);
    }
    expect(mocks.apiKeyUpdateMany).not.toHaveBeenCalled();
  });

  it("creates a project and returns its generated API key once while storing only its hash", async () => {
    mocks.transaction.mockImplementation(async (callback) => callback({
      project: { create: mocks.projectCreate },
      apiKey: { create: mocks.apiKeyCreate }
    }));
    mocks.projectCreate.mockResolvedValue(project);
    mocks.apiKeyCreate.mockResolvedValue({});

    const response = await request(app).post("/api/v1/projects").send({ name: "test project" });
    expect(response.status).toBe(201);
    expect(response.body.project).toEqual(project);
    expect(response.body.apiKey).toMatch(/^relay_[A-Za-z0-9_-]{43}$/);
    expect(mocks.apiKeyCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        keyHash: hashApiKey(response.body.apiKey)
      })
    }));
    expect(JSON.stringify(mocks.apiKeyCreate.mock.calls)).not.toContain(response.body.apiKey);
  });

  it("creates and revokes API keys within the authenticated project", async () => {
    const keyRecord = { id: endpoint.id, name: "secondary", createdAt: new Date() };
    mocks.apiKeyCreate.mockResolvedValue(keyRecord);
    let response = await authenticate(request(app).post("/api/v1/api-keys")).send({ name: "secondary" });
    expect(response.status).toBe(201);
    expect(response.body.apiKey).toMatch(/^relay_[A-Za-z0-9_-]{43}$/);

    mocks.apiKeyUpdateMany.mockResolvedValue({ count: 1 });
    response = await authenticate(request(app).delete(`/api/v1/api-keys/${endpoint.id}`));
    expect(response.status).toBe(204);
    expect(mocks.apiKeyUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: endpoint.id, projectId: project.id, revokedAt: null }
    }));
  });
});

describe("webhook endpoint management", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiKeyFindUnique.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      projectId: project.id,
      revokedAt: null,
      project
    });
    mocks.apiKeyUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("creates an encrypted endpoint and returns its signing secret exactly once", async () => {
    mocks.endpointCreate.mockImplementation(async ({ data, select }) => {
      expect(data.encryptedSecret).toMatch(/^v1:/);
      expect(select).not.toHaveProperty("encryptedSecret");
      return endpoint;
    });
    const response = await request(app)
      .post("/api/v1/endpoints")
      .set("Authorization", `Bearer ${rawKey}`)
      .send({ url: endpoint.url, description: "test" });

    expect(response.status).toBe(201);
    expect(response.body.signingSecret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(response.body).not.toHaveProperty("encryptedSecret");
    const storedSecret = mocks.endpointCreate.mock.calls[0][0].data.encryptedSecret;
    expect(storedSecret).not.toBe(response.body.signingSecret);
    expect(decryptEndpointSecret(storedSecret)).toBe(response.body.signingSecret);
    expect(mocks.endpointCreate.mock.calls[0][0].data.projectId).toBe(project.id);
  });

  it("lists, reads, updates and soft-deletes endpoints within project scope", async () => {
    mocks.endpointFindMany.mockResolvedValue([endpoint]);
    mocks.endpointFindFirst.mockResolvedValue(endpoint);
    mocks.endpointUpdateMany.mockResolvedValue({ count: 1 });

    let response = await request(app).get("/api/v1/endpoints").set("Authorization", `Bearer ${rawKey}`);
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain("signingSecret");
    expect(mocks.endpointFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId: project.id, deletedAt: null }
    }));

    response = await request(app).get(`/api/v1/endpoints/${endpoint.id}`).set("Authorization", `Bearer ${rawKey}`);
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain("signingSecret");
    expect(mocks.endpointFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: endpoint.id, projectId: project.id, deletedAt: null }
    }));

    response = await request(app).patch(`/api/v1/endpoints/${endpoint.id}`)
      .set("Authorization", `Bearer ${rawKey}`).send({ isActive: false });
    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).not.toContain("signingSecret");

    response = await request(app).delete(`/api/v1/endpoints/${endpoint.id}`).set("Authorization", `Bearer ${rawKey}`);
    expect(response.status).toBe(204);
    expect(mocks.endpointUpdateMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { id: endpoint.id, projectId: project.id, deletedAt: null },
      data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) })
    }));
    expect(JSON.stringify(response.body)).not.toContain("signingSecret");
  });

  it("does not allow reading or mutating another project's endpoint", async () => {
    mocks.endpointFindFirst.mockResolvedValue(null);
    mocks.endpointUpdateMany.mockResolvedValue({ count: 0 });

    let response = await request(app).get(`/api/v1/endpoints/${endpoint.id}`).set("Authorization", `Bearer ${rawKey}`);
    expect(response.status).toBe(404);
    response = await request(app).patch(`/api/v1/endpoints/${endpoint.id}`)
      .set("Authorization", `Bearer ${rawKey}`).send({ isActive: false });
    expect(response.status).toBe(404);
    expect(mocks.endpointFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ projectId: project.id })
    }));
  });

  it("rejects invalid URLs and bodies before writing", async () => {
    vi.mocked(validateWebhookUrl).mockRejectedValueOnce(new Error("URL must use HTTPS"));
    let response = await request(app).post("/api/v1/endpoints")
      .set("Authorization", `Bearer ${rawKey}`).send({ url: "http://127.0.0.1" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_URL");

    response = await request(app).post("/api/v1/endpoints")
      .set("Authorization", `Bearer ${rawKey}`).send({ url: endpoint.url, secret: "not accepted" });
    expect(response.status).toBe(400);
    expect(mocks.endpointCreate).not.toHaveBeenCalled();
  });
});

describe("event ingestion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiKeyFindUnique.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      projectId: project.id,
      revokedAt: null,
      project
    });
    mocks.apiKeyUpdateMany.mockResolvedValue({ count: 1 });
    mocks.eventFindUnique.mockResolvedValue(null);
    mocks.eventCreate.mockResolvedValue(event);
    mocks.outboxMessageCreate.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback) => callback({
      event: { create: mocks.eventCreate },
      outboxMessage: { create: mocks.outboxMessageCreate }
    }));
  });

  it("persists a pending event and its outbox record in one transaction", async () => {
    const response = await request(app).post("/api/v1/events")
      .set("Authorization", `Bearer ${rawKey}`)
      .set("Idempotency-Key", event.idempotencyKey!)
      .send({ eventType: event.eventType, payload: event.payload });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ duplicate: false, event: { id: event.id, status: "pending" } });
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
    expect(mocks.eventCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      projectId: project.id,
      idempotencyKey: event.idempotencyKey,
      eventType: event.eventType,
      payload: event.payload,
      status: "pending"
    }) }));
    expect(mocks.outboxMessageCreate).toHaveBeenCalledWith({ data: {
      eventId: event.id,
      eventType: event.eventType,
      payload: event.payload
    } });
  });

  it.each([
    {},
    { eventType: "", payload: {} },
    { eventType: "x".repeat(256), payload: {} },
    { eventType: "invoice.paid" },
    { eventType: "invoice.paid", payload: [] },
    { eventType: "invoice.paid", payload: {}, projectId: project.id },
    { eventType: "invoice.paid", payload: {}, status: "sent" }
  ])("rejects invalid event bodies", async (body) => {
    const response = await request(app).post("/api/v1/events")
      .set("Authorization", `Bearer ${rawKey}`)
      .send(body);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid idempotency keys before writing", async () => {
    const response = await request(app).post("/api/v1/events")
      .set("Authorization", `Bearer ${rawKey}`)
      .set("Idempotency-Key", " ")
      .send({ eventType: event.eventType, payload: event.payload });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires a valid API key", async () => {
    let response = await request(app).post("/api/v1/events")
      .send({ eventType: event.eventType, payload: event.payload });
    expect(response.status).toBe(401);

    response = await request(app).post("/api/v1/events")
      .set("Authorization", "Bearer invalid")
      .send({ eventType: event.eventType, payload: event.payload });
    expect(response.status).toBe(401);

    mocks.apiKeyFindUnique.mockResolvedValueOnce(null);
    response = await request(app).post("/api/v1/events")
      .set("Authorization", `Bearer ${rawKey}`)
      .send({ eventType: event.eventType, payload: event.payload });
    expect(response.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns the existing project-scoped event for a duplicate idempotency key", async () => {
    mocks.eventFindUnique.mockResolvedValue(event);
    const response = await request(app).post("/api/v1/events")
      .set("Authorization", `Bearer ${rawKey}`)
      .set("Idempotency-Key", event.idempotencyKey!)
      .send({ eventType: "different.event", payload: { ignored: true } });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ duplicate: true, event: { id: event.id } });
    expect(mocks.eventFindUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId_idempotencyKey: { projectId: project.id, idempotencyKey: event.idempotencyKey } }
    }));
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.outboxMessageCreate).not.toHaveBeenCalled();
  });

  it("allows different projects to reuse an idempotency key", async () => {
    const otherProject = { id: "55555555-5555-4555-8555-555555555555", name: "other project" };
    const otherEvent = { ...event, id: "66666666-6666-4666-8666-666666666666", projectId: otherProject.id };
    mocks.eventCreate.mockImplementation(async ({ data }) => data.projectId === project.id ? event : otherEvent);

    let response = await request(app).post("/api/v1/events")
      .set("Authorization", `Bearer ${rawKey}`)
      .set("Idempotency-Key", event.idempotencyKey!)
      .send({ eventType: event.eventType, payload: event.payload });
    expect(response.status).toBe(201);

    mocks.apiKeyFindUnique.mockResolvedValueOnce({
      id: "77777777-7777-4777-8777-777777777777", projectId: otherProject.id, revokedAt: null, project: otherProject
    });
    response = await request(app).post("/api/v1/events")
      .set("Authorization", `Bearer ${rawKey}`)
      .set("Idempotency-Key", event.idempotencyKey!)
      .send({ eventType: event.eventType, payload: event.payload });
    expect(response.status).toBe(201);
    expect(mocks.eventCreate).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ projectId: otherProject.id })
    }));
  });

  it("creates independent events without an idempotency key", async () => {
    await request(app).post("/api/v1/events").set("Authorization", `Bearer ${rawKey}`)
      .send({ eventType: event.eventType, payload: event.payload });
    await request(app).post("/api/v1/events").set("Authorization", `Bearer ${rawKey}`)
      .send({ eventType: event.eventType, payload: event.payload });

    expect(mocks.eventFindUnique).not.toHaveBeenCalled();
    expect(mocks.transaction).toHaveBeenCalledTimes(2);
    expect(mocks.eventCreate).toHaveBeenCalledTimes(2);
  });

  it("recovers concurrent duplicate requests from the database unique constraint", async () => {
    mocks.eventFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce(event);
    mocks.eventCreate.mockResolvedValueOnce(event).mockRejectedValueOnce({ code: "P2002" });

    const responses = await Promise.all([
      request(app).post("/api/v1/events").set("Authorization", `Bearer ${rawKey}`)
        .set("Idempotency-Key", event.idempotencyKey!).send({ eventType: event.eventType, payload: event.payload }),
      request(app).post("/api/v1/events").set("Authorization", `Bearer ${rawKey}`)
        .set("Idempotency-Key", event.idempotencyKey!).send({ eventType: event.eventType, payload: event.payload })
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([200, 201]);
    expect(responses.some((response) => response.body.duplicate === true)).toBe(true);
    expect(mocks.outboxMessageCreate).toHaveBeenCalledTimes(1);
  });

  it("does not report partial persistence when outbox creation fails", async () => {
    mocks.outboxMessageCreate.mockRejectedValueOnce(new Error("outbox write failed"));
    const response = await request(app).post("/api/v1/events")
      .set("Authorization", `Bearer ${rawKey}`)
      .send({ eventType: event.eventType, payload: event.payload });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe("INTERNAL_ERROR");
    expect(mocks.transaction).toHaveBeenCalledTimes(1);
  });
});

describe("event listing", () => {
  const listedEvents = [
    { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", eventType: "invoice.paid", payload: { index: 1 }, status: "delivered", createdAt: new Date("2026-01-03T00:00:00Z"), updatedAt: new Date("2026-01-03T00:00:00Z") },
    { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", eventType: "invoice.paid", payload: { index: 2 }, status: "pending", createdAt: new Date("2026-01-02T00:00:00Z"), updatedAt: new Date("2026-01-02T00:00:00Z") },
    { id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", eventType: "invoice.failed", payload: { index: 3 }, status: "failed", createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z") }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiKeyFindUnique.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      projectId: project.id,
      revokedAt: null,
      project
    });
    mocks.apiKeyUpdateMany.mockResolvedValue({ count: 1 });
    mocks.eventFindFirst.mockResolvedValue({ id: listedEvents[0].id });
    mocks.eventFindMany.mockResolvedValue([]);
  });

  it("requires a valid API key before querying events", async () => {
    let response = await request(app).get("/api/v1/events");
    expect(response.status).toBe(401);
    response = await request(app).get("/api/v1/events").set("Authorization", "Bearer invalid");
    expect(response.status).toBe(401);
    expect(mocks.eventFindMany).not.toHaveBeenCalled();
  });

  it("lists newest events first with a default limit and only safe event fields", async () => {
    mocks.eventFindMany.mockResolvedValue(listedEvents.slice(0, 2));
    const response = await request(app).get("/api/v1/events")
      .set("Authorization", `Bearer ${rawKey}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: JSON.parse(JSON.stringify(listedEvents.slice(0, 2))),
      pagination: { nextCursor: null, hasMore: false }
    });
    expect(mocks.eventFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId: project.id },
      select: {
        id: true,
        eventType: true,
        payload: true,
        status: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 21
    }));
    expect(response.body.data[0]).not.toHaveProperty("projectId");
    expect(response.body.data[0]).not.toHaveProperty("idempotencyKey");
    expect(JSON.stringify(response.body)).not.toContain(rawKey);
  });

  it("uses a project-validated cursor and returns the next page cursor", async () => {
    mocks.eventFindFirst.mockResolvedValue({ id: listedEvents[0].id });
    mocks.eventFindMany.mockResolvedValue(listedEvents);
    const response = await request(app).get(`/api/v1/events?cursor=${listedEvents[0].id}&limit=2`)
      .set("Authorization", `Bearer ${rawKey}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(JSON.parse(JSON.stringify(listedEvents.slice(0, 2))));
    expect(response.body.pagination).toEqual({
      nextCursor: listedEvents[1].id,
      hasMore: true
    });
    expect(mocks.eventFindFirst).toHaveBeenCalledWith({
      where: { id: listedEvents[0].id, projectId: project.id },
      select: { id: true }
    });
    expect(mocks.eventFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId: project.id },
      cursor: { id: listedEvents[0].id },
      skip: 1,
      take: 3
    }));
  });

  it("applies the optional status filter within project scope", async () => {
    mocks.eventFindMany.mockResolvedValue([listedEvents[1]]);
    const response = await request(app).get("/api/v1/events?status=pending&limit=5")
      .set("Authorization", `Bearer ${rawKey}`);

    expect(response.status).toBe(200);
    expect(mocks.eventFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId: project.id, status: "pending" },
      take: 6
    }));
  });

  it("rejects cursors from another project without listing events", async () => {
    mocks.eventFindFirst.mockResolvedValue(null);
    const response = await request(app).get(`/api/v1/events?cursor=${listedEvents[0].id}`)
      .set("Authorization", `Bearer ${rawKey}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
    expect(mocks.eventFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: listedEvents[0].id, projectId: project.id }
    }));
    expect(mocks.eventFindMany).not.toHaveBeenCalled();
  });

  it.each([
    "?limit=0",
    "?limit=101",
    "?limit=1.5",
    "?limit=abc",
    "?status=queued",
    "?cursor=not-a-uuid",
    "?unknown=value"
  ])("rejects invalid event list query parameters: %s", async (query) => {
    const response = await request(app).get(`/api/v1/events${query}`)
      .set("Authorization", `Bearer ${rawKey}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
    expect(mocks.eventFindMany).not.toHaveBeenCalled();
  });
});

describe("event details", () => {
  const eventId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const eventDetails = {
    id: eventId,
    eventType: "invoice.paid",
    payload: { invoiceId: "inv_123" },
    status: "failed",
    createdAt: new Date("2026-01-03T00:00:00Z"),
    updatedAt: new Date("2026-01-03T00:01:00Z"),
    deliveryTargets: [{ endpointId: endpoint.id }],
    attempts: [{
      attemptNumber: 1,
      status: "failed",
      responseStatusCode: 500,
      errorMessage: "Webhook endpoint returned HTTP 500.",
      durationMs: 125,
      attemptedAt: new Date("2026-01-03T00:00:30Z")
    }]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiKeyFindUnique.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      projectId: project.id,
      revokedAt: null,
      project
    });
    mocks.apiKeyUpdateMany.mockResolvedValue({ count: 1 });
    mocks.eventFindFirst.mockResolvedValue(eventDetails);
  });

  it("requires API key authentication", async () => {
    let response = await request(app).get(`/api/v1/events/${eventId}`);
    expect(response.status).toBe(401);
    response = await request(app).get(`/api/v1/events/${eventId}`)
      .set("Authorization", "Bearer invalid");
    expect(response.status).toBe(401);
    expect(mocks.eventFindFirst).not.toHaveBeenCalled();
  });

  it("returns event details, delivery targets and attempts without internal secrets", async () => {
    const response = await request(app).get(`/api/v1/events/${eventId}`)
      .set("Authorization", `Bearer ${rawKey}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(JSON.parse(JSON.stringify(eventDetails)));
    expect(mocks.eventFindFirst).toHaveBeenCalledWith({
      where: { id: eventId, projectId: project.id },
      select: {
        id: true,
        eventType: true,
        payload: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        deliveryTargets: { select: { endpointId: true } },
        attempts: {
          select: {
            attemptNumber: true,
            status: true,
            responseStatusCode: true,
            errorMessage: true,
            durationMs: true,
            attemptedAt: true
          },
          orderBy: [{ attemptedAt: "asc" }, { id: "asc" }]
        }
      }
    });
    expect(JSON.stringify(response.body)).not.toContain("encryptedSecret");
    expect(JSON.stringify(response.body)).not.toContain("signingSecret");
    expect(JSON.stringify(response.body)).not.toContain("keyHash");
    expect(JSON.stringify(response.body)).not.toContain(rawKey);
  });

  it.each(["missing event", "event owned by another project"])("%s returns 404", async () => {
    mocks.eventFindFirst.mockResolvedValue(null);
    const response = await request(app).get(`/api/v1/events/${eventId}`)
      .set("Authorization", `Bearer ${rawKey}`);

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(mocks.eventFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: eventId, projectId: project.id }
    }));
  });

  it("rejects malformed event IDs without querying the database", async () => {
    const response = await request(app).get("/api/v1/events/not-a-uuid")
      .set("Authorization", `Bearer ${rawKey}`);

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
    expect(mocks.eventFindFirst).not.toHaveBeenCalled();
  });
});

describe("event replay API", () => {
  const eventId = event.id;
  const failedEndpointId = endpoint.id;
  const succeededEndpointId = "55555555-5555-4555-8555-555555555555";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiKeyFindUnique.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      projectId: project.id,
      revokedAt: null,
      project
    });
    mocks.apiKeyUpdateMany.mockResolvedValue({ count: 1 });
    mocks.replayQueryRaw.mockResolvedValue([{ id: eventId }]);
    mocks.replayEventFindFirst.mockResolvedValue({
      id: eventId,
      status: "failed",
      deliveryTargets: [
        { endpointId: failedEndpointId, endpoint: { isActive: true, deletedAt: null } },
        { endpointId: succeededEndpointId, endpoint: { isActive: true, deletedAt: null } }
      ]
    });
    mocks.replayAttemptFindMany.mockResolvedValue([
      { endpointId: succeededEndpointId, status: "delivered" },
      { endpointId: failedEndpointId, status: "failed" }
    ]);
    mocks.replayRequestCreate.mockResolvedValue({
      id: "66666666-6666-4666-8666-666666666666",
      status: "pending"
    });
    mocks.transaction.mockImplementation(async (callback) => callback({
      $queryRaw: mocks.replayQueryRaw,
      event: { findFirst: mocks.replayEventFindFirst },
      deliveryAttempt: { findMany: mocks.replayAttemptFindMany },
      replayRequest: { create: mocks.replayRequestCreate }
    }));
  });

  it("requires API key authentication", async () => {
    let response = await request(app).post(`/api/v1/events/${eventId}/replay`);
    expect(response.status).toBe(401);
    response = await request(app).post(`/api/v1/events/${eventId}/replay`)
      .set("Authorization", "Bearer invalid");
    expect(response.status).toBe(401);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("creates a durable request for only failed endpoints within the authenticated project", async () => {
    const response = await request(app).post(`/api/v1/events/${eventId}/replay`)
      .set("Authorization", `Bearer ${rawKey}`);

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      replayRequestId: "66666666-6666-4666-8666-666666666666",
      status: "pending"
    });
    expect(mocks.replayQueryRaw).toHaveBeenCalledOnce();
    expect(mocks.replayEventFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: eventId, projectId: project.id }
    }));
    expect(mocks.replayRequestCreate).toHaveBeenCalledWith({
      data: {
        eventId,
        status: "pending",
        targets: { create: [{ endpointId: failedEndpointId }] }
      },
      select: { id: true, status: true }
    });
    expect(JSON.stringify(response.body)).not.toContain(rawKey);
  });

  it("returns 404 for an event outside the project and 409 for a non-replayable event", async () => {
    mocks.replayEventFindFirst.mockResolvedValueOnce(null);
    let response = await request(app).post(`/api/v1/events/${eventId}/replay`)
      .set("Authorization", `Bearer ${rawKey}`);
    expect(response.status).toBe(404);

    mocks.replayEventFindFirst.mockResolvedValueOnce({
      id: eventId,
      status: "delivered",
      deliveryTargets: []
    });
    response = await request(app).post(`/api/v1/events/${eventId}/replay`)
      .set("Authorization", `Bearer ${rawKey}`);
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EVENT_NOT_REPLAYABLE");
    expect(mocks.replayRequestCreate).not.toHaveBeenCalled();
  });

  it("rejects malformed event IDs", async () => {
    const response = await request(app).post("/api/v1/events/not-a-uuid/replay")
      .set("Authorization", `Bearer ${rawKey}`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe("delivery management API", () => {
  const deliveryId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const cursorId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const eventId = event.id;
  const endpointId = endpoint.id;
  const replayRequestId = "77777777-7777-4777-8777-777777777777";
  const attempt = {
    id: deliveryId,
    attemptNumber: 2,
    status: "failed",
    responseStatusCode: 503,
    errorMessage: "Webhook endpoint returned HTTP 503.",
    durationMs: 120,
    attemptedAt: new Date("2026-02-01T00:00:00Z"),
    replayRequestId,
    event: { id: eventId, eventType: "invoice.paid" },
    endpoint: { id: endpointId }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiKeyFindUnique.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      projectId: project.id,
      revokedAt: null,
      project
    });
    mocks.apiKeyUpdateMany.mockResolvedValue({ count: 1 });
    mocks.deliveryAttemptFindFirst.mockResolvedValue({ id: cursorId });
    mocks.deliveryAttemptFindMany.mockResolvedValue([]);
  });

  it("requires authentication for delivery listing and details", async () => {
    let response = await request(app).get("/api/v1/deliveries");
    expect(response.status).toBe(401);
    response = await request(app).get(`/api/v1/deliveries/${deliveryId}`)
      .set("Authorization", "Bearer invalid");
    expect(response.status).toBe(401);
    expect(mocks.deliveryAttemptFindMany).not.toHaveBeenCalled();
    expect(mocks.deliveryAttemptFindFirst).not.toHaveBeenCalled();
  });

  it("lists newest attempts with default pagination and project isolation", async () => {
    mocks.deliveryAttemptFindMany.mockResolvedValue([attempt]);
    const response = await request(app).get("/api/v1/deliveries")
      .set("Authorization", `Bearer ${rawKey}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      data: JSON.parse(JSON.stringify([attempt])),
      pagination: { nextCursor: null, hasMore: false }
    });
    expect(mocks.deliveryAttemptFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { event: { projectId: project.id } },
      orderBy: [{ attemptedAt: "desc" }, { id: "desc" }],
      take: 21,
      select: expect.objectContaining({
        replayRequestId: true,
        event: { select: { id: true, eventType: true } },
        endpoint: { select: { id: true } }
      })
    }));
    expect(response.body.data[0].replayRequestId).toBe(replayRequestId);
  });

  it("paginates using a cursor verified within the project", async () => {
    mocks.deliveryAttemptFindMany.mockResolvedValue([
      attempt,
      { ...attempt, id: cursorId }
    ]);
    const response = await request(app).get(`/api/v1/deliveries?cursor=${cursorId}&limit=1`)
      .set("Authorization", `Bearer ${rawKey}`);

    expect(response.status).toBe(200);
    expect(response.body.pagination).toEqual({ nextCursor: deliveryId, hasMore: true });
    expect(mocks.deliveryAttemptFindFirst).toHaveBeenCalledWith({
      where: { id: cursorId, event: { projectId: project.id } },
      select: { id: true }
    });
    expect(mocks.deliveryAttemptFindMany).toHaveBeenCalledWith(expect.objectContaining({
      cursor: { id: cursorId },
      skip: 1,
      take: 2
    }));
  });

  it("applies status, event ID and endpoint ID filters without losing project scope", async () => {
    const response = await request(app)
      .get(`/api/v1/deliveries?status=failed&eventId=${eventId}&endpointId=${endpointId}`)
      .set("Authorization", `Bearer ${rawKey}`);

    expect(response.status).toBe(200);
    expect(mocks.deliveryAttemptFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        event: { projectId: project.id },
        status: "failed",
        eventId,
        endpointId
      }
    }));
  });

  it.each([
    "?cursor=not-a-uuid",
    "?limit=0",
    "?limit=101",
    "?limit=2.5",
    "?status=processing",
    "?eventId=invalid",
    "?endpointId=invalid",
    "?extra=unexpected"
  ])("rejects invalid delivery list query parameters: %s", async (query) => {
    const response = await request(app).get(`/api/v1/deliveries${query}`)
      .set("Authorization", `Bearer ${rawKey}`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
    expect(mocks.deliveryAttemptFindMany).not.toHaveBeenCalled();
  });

  it("returns delivery details with safe event and endpoint metadata", async () => {
    const detail = {
      ...attempt,
      responseBody: "Unavailable",
      event: { ...attempt.event, status: "failed", createdAt: new Date("2026-01-01T00:00:00Z") },
      endpoint: {
        id: endpointId,
        url: endpoint.url,
        description: endpoint.description,
        isActive: true,
        deletedAt: null
      }
    };
    mocks.deliveryAttemptFindFirst.mockResolvedValue(detail);

    const response = await request(app).get(`/api/v1/deliveries/${deliveryId}`)
      .set("Authorization", `Bearer ${rawKey}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual(JSON.parse(JSON.stringify(detail)));
    expect(mocks.deliveryAttemptFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: deliveryId, event: { projectId: project.id } },
      select: expect.objectContaining({
        replayRequestId: true,
        event: { select: { id: true, eventType: true, status: true, createdAt: true } },
        endpoint: {
          select: {
            id: true,
            url: true,
            description: true,
            isActive: true,
            deletedAt: true
          }
        }
      })
    }));
    expect(JSON.stringify(response.body)).not.toContain("encryptedSecret");
    expect(JSON.stringify(response.body)).not.toContain("keyHash");
    expect(JSON.stringify(response.body)).not.toContain(rawKey);
  });

  it("returns 404 for missing or cross-project deliveries and 400 for invalid IDs", async () => {
    mocks.deliveryAttemptFindFirst.mockResolvedValue(null);
    let response = await request(app).get(`/api/v1/deliveries/${deliveryId}`)
      .set("Authorization", `Bearer ${rawKey}`);
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
    expect(mocks.deliveryAttemptFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: deliveryId, event: { projectId: project.id } }
    }));

    response = await request(app).get("/api/v1/deliveries/not-a-uuid")
      .set("Authorization", `Bearer ${rawKey}`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("INVALID_REQUEST");
    expect(mocks.deliveryAttemptFindFirst).toHaveBeenCalledTimes(1);
  });
});

describe("dashboard analytics API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiKeyFindUnique.mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      projectId: project.id,
      revokedAt: null,
      project
    });
    mocks.apiKeyUpdateMany.mockResolvedValue({ count: 1 });
    mocks.eventGroupBy.mockResolvedValue([
      { status: "delivered", _count: { _all: 8 } },
      { status: "failed", _count: { _all: 2 } },
      { status: "pending", _count: { _all: 3 } },
      { status: "processing", _count: { _all: 1 } },
      { status: "skipped", _count: { _all: 1 } }
    ]);
    mocks.endpointCount.mockResolvedValue(4);
    mocks.deliveryAttemptGroupBy.mockResolvedValue([
      { status: "delivered", _count: { _all: 6 } },
      { status: "failed", _count: { _all: 2 } },
      { status: "retrying", _count: { _all: 3 } },
      { status: "skipped", _count: { _all: 1 } }
    ]);
    mocks.eventFindMany.mockResolvedValue([]);
    mocks.deliveryAttemptFindMany.mockResolvedValue([]);
  });

  it("requires API key authentication for dashboard endpoints", async () => {
    for (const path of [
      "/api/v1/dashboard/stats",
      "/api/v1/dashboard/activity",
      "/api/v1/dashboard/delivery-health"
    ]) {
      const response = await request(app).get(path);
      expect(response.status).toBe(401);
    }
    expect(mocks.eventGroupBy).not.toHaveBeenCalled();
    expect(mocks.eventFindMany).not.toHaveBeenCalled();
    expect(mocks.deliveryAttemptGroupBy).not.toHaveBeenCalled();
  });

  it("returns project-scoped aggregate stats and handles empty data rates", async () => {
    const response = await request(app).get("/api/v1/dashboard/stats")
      .set("Authorization", `Bearer ${rawKey}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      totalEvents: 15,
      deliveredEvents: 8,
      failedEvents: 2,
      pendingProcessingEvents: 4,
      activeEndpoints: 4,
      totalDeliveryAttempts: 12,
      successRate: 50,
      failureRate: 16.67
    });
    expect(mocks.eventGroupBy).toHaveBeenCalledWith(expect.objectContaining({
      by: ["status"],
      where: { projectId: project.id }
    }));
    expect(mocks.endpointCount).toHaveBeenCalledWith({
      where: { projectId: project.id, isActive: true, deletedAt: null }
    });
    expect(mocks.deliveryAttemptGroupBy).toHaveBeenCalledWith(expect.objectContaining({
      by: ["status"],
      where: { event: { projectId: project.id } }
    }));

    mocks.eventGroupBy.mockResolvedValueOnce([]);
    mocks.endpointCount.mockResolvedValueOnce(0);
    mocks.deliveryAttemptGroupBy.mockResolvedValueOnce([]);
    const emptyResponse = await request(app).get("/api/v1/dashboard/stats")
      .set("Authorization", `Bearer ${rawKey}`);
    expect(emptyResponse.body.data).toEqual({
      totalEvents: 0,
      deliveredEvents: 0,
      failedEvents: 0,
      pendingProcessingEvents: 0,
      activeEndpoints: 0,
      totalDeliveryAttempts: 0,
      successRate: 0,
      failureRate: 0
    });
  });

  describe("OpenAPI documentation", () => {
    it("serves the OpenAPI 3.1 specification at the documented URL", async () => {
      const response = await request(app).get("/api/docs/openapi.json");
      expect(response.status).toBe(200);
      expect(response.body.openapi).toBe("3.1.0");
      expect(response.body).toEqual(openApiSpec);
      expect(response.body.paths).toHaveProperty("/events/{id}/replay");
      expect(response.body.paths).toHaveProperty("/dashboard/delivery-health");
      expect(response.body.components.securitySchemes.bearerApiKey.scheme).toBe("bearer");
    });

    it("serves a readable API reference linking to the machine-readable specification", async () => {
      const response = await request(app).get("/api/docs");
      expect(response.status).toBe(200);
      expect(response.type).toBe("text/html");
      expect(response.text).toContain("/api/docs/openapi.json");
      expect(response.text).toContain("Webhook signature verification");
      expect(response.text).toContain("/events/{id}/replay");
      expect(response.text).toContain("Bearer API key");
    });
  });

  it("returns newest bounded event and attempt activity without payloads or secrets", async () => {
    const recentEvent = {
      id: event.id,
      eventType: event.eventType,
      status: "delivered",
      createdAt: new Date("2026-03-01T00:00:00Z")
    };
    const recentAttempt = {
      id: "88888888-8888-4888-8888-888888888888",
      attemptNumber: 1,
      status: "delivered",
      responseStatusCode: 204,
      durationMs: 42,
      attemptedAt: new Date("2026-03-01T00:00:01Z"),
      replayRequestId: null,
      event: { id: event.id, eventType: event.eventType },
      endpoint: { id: endpoint.id }
    };
    mocks.eventFindMany.mockResolvedValue([recentEvent]);
    mocks.deliveryAttemptFindMany.mockResolvedValue([recentAttempt]);

    const response = await request(app).get("/api/v1/dashboard/activity?limit=5")
      .set("Authorization", `Bearer ${rawKey}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(JSON.parse(JSON.stringify({
      events: [recentEvent],
      deliveryAttempts: [recentAttempt]
    })));
    expect(mocks.eventFindMany).toHaveBeenCalledWith({
      where: { projectId: project.id },
      select: { id: true, eventType: true, status: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 5
    });
    expect(mocks.deliveryAttemptFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { event: { projectId: project.id } },
      orderBy: [{ attemptedAt: "desc" }, { id: "desc" }],
      take: 5
    }));
    expect(JSON.stringify(response.body)).not.toContain("payload");
    expect(JSON.stringify(response.body)).not.toContain("encryptedSecret");
  });

  it("uses the default activity limit and rejects invalid activity parameters", async () => {
    let response = await request(app).get("/api/v1/dashboard/activity")
      .set("Authorization", `Bearer ${rawKey}`);
    expect(response.status).toBe(200);
    expect(mocks.eventFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
    expect(mocks.deliveryAttemptFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));

    for (const query of ["?limit=0", "?limit=51", "?limit=2.5", "?limit=no", "?extra=1"]) {
      response = await request(app).get(`/api/v1/dashboard/activity${query}`)
        .set("Authorization", `Bearer ${rawKey}`);
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_REQUEST");
    }
  });

  it("returns project-scoped delivery health for the validated time window", async () => {
    const before = Date.now();
    const response = await request(app).get("/api/v1/dashboard/delivery-health?window=7d")
      .set("Authorization", `Bearer ${rawKey}`);
    const after = Date.now();

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      window: "7d",
      delivered: 6,
      failed: 2,
      retrying: 3,
      pending: 0,
      successRate: 75
    });
    const query = mocks.deliveryAttemptGroupBy.mock.calls[0][0];
    expect(query.where.event).toEqual({ projectId: project.id });
    expect(query.where.attemptedAt.gte.getTime()).toBeGreaterThanOrEqual(before - 7 * 24 * 60 * 60 * 1000);
    expect(query.where.attemptedAt.gte.getTime()).toBeLessThanOrEqual(after - 7 * 24 * 60 * 60 * 1000);

    const invalidResponse = await request(app).get("/api/v1/dashboard/delivery-health?window=forever")
      .set("Authorization", `Bearer ${rawKey}`);
    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error.code).toBe("INVALID_REQUEST");
  });
});
