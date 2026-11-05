import { prisma } from "../config/prisma";
import { generateApiKey, hashApiKey } from "../utils/api-key";

export async function createProject(name: string) {
  const apiKey = generateApiKey();
  const project = await prisma.$transaction(async (transaction) => {
    const created = await transaction.project.create({ data: { name } });
    await transaction.apiKey.create({
      data: {
        projectId: created.id,
        name: "Initial API key",
        keyHash: hashApiKey(apiKey)
      }
    });
    return created;
  });

  return { project, apiKey };
}

export async function createProjectApiKey(projectId: string, name: string) {
  const apiKey = generateApiKey();
  const record = await prisma.apiKey.create({
    data: { projectId, name, keyHash: hashApiKey(apiKey) },
    select: { id: true, name: true, createdAt: true }
  });
  return { ...record, apiKey };
}

export async function revokeProjectApiKey(projectId: string, id: string): Promise<boolean> {
  const result = await prisma.apiKey.updateMany({
    where: { id, projectId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
  return result.count > 0;
}
