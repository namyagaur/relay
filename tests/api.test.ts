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
      findFirst: mocks.endpointFindFirst,
      updateMany: mocks.endpointUpdateMany
    },
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
