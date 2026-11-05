import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createProject, createProjectApiKey, revokeProjectApiKey } from "../services/project-service";

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120)
}).strict();
const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(120)
}).strict();
const idSchema = z.string().uuid();

function badRequest(res: Response): void {
  res.status(400).json({ error: { code: "INVALID_REQUEST", message: "Request validation failed." } });
}

export async function createProjectController(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res);

  try {
    const result = await createProject(parsed.data.name);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function createApiKeyController(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsed = createApiKeySchema.safeParse(req.body);
  if (!parsed.success || !req.authenticatedProject) return badRequest(res);

  try {
    const apiKey = await createProjectApiKey(req.authenticatedProject.id, parsed.data.name);
    res.status(201).json(apiKey);
  } catch (error) {
    next(error);
  }
}

export async function revokeApiKeyController(req: Request, res: Response, next: NextFunction): Promise<void> {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success || !req.authenticatedProject) return badRequest(res);

  try {
    const revoked = await revokeProjectApiKey(req.authenticatedProject.id, id.data);
    if (!revoked) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "API key not found." } });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
