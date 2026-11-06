import { randomBytes } from "node:crypto";
import { prisma } from "../config/prisma";
import { encryptEndpointSecret } from "../utils/endpoint-secret";
import { validateWebhookUrl } from "./webhook-url";

const endpointFields = {
  id: true,
  url: true,
  description: true,
  isActive: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true
} as const;

export async function listEndpoints(projectId: string) {
  return prisma.endpoint.findMany({
    where: { projectId, deletedAt: null },
    select: endpointFields,
    orderBy: { createdAt: "desc" }
  });
}

export async function createEndpoint(
  projectId: string,
  input: { url: string; description?: string }
) {
  const target = await validateWebhookUrl(input.url);
  const signingSecret = randomBytes(32).toString("base64url");
  const endpoint = await prisma.endpoint.create({
    data: {
      projectId,
      url: target.url,
      description: input.description,
      encryptedSecret: encryptEndpointSecret(signingSecret)
    },
    select: endpointFields
  });

  return { ...endpoint, signingSecret };
}

export async function getEndpoint(projectId: string, id: string) {
  return prisma.endpoint.findFirst({
    where: { id, projectId, deletedAt: null },
    select: endpointFields
  });
}

export async function updateEndpoint(
  projectId: string,
  id: string,
  input: { url?: string; description?: string | null; isActive?: boolean }
) {
  const data: {
    url?: string;
    description?: string | null;
    isActive?: boolean;
  } = { ...input };
  if (input.url) {
    const target = await validateWebhookUrl(input.url);
    data.url = target.url;
  }

  const result = await prisma.endpoint.updateMany({
    where: { id, projectId, deletedAt: null },
    data
  });
  if (result.count === 0) return null;

  return getEndpoint(projectId, id);
}

export async function softDeleteEndpoint(projectId: string, id: string): Promise<boolean> {
  const result = await prisma.endpoint.updateMany({
    where: { id, projectId, deletedAt: null },
    data: { isActive: false, deletedAt: new Date() }
  });
  return result.count > 0;
}
