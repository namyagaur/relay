import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  createEndpoint,
  getEndpoint,
  listEndpoints,
  softDeleteEndpoint,
  updateEndpoint
} from "../services/endpoint-service";

const createEndpointSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  description: z.string().trim().max(500).optional()
}).strict();
const updateEndpointSchema = z.object({
  url: z.string().trim().min(1).max(2048).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional()
}).strict().refine((value) => Object.keys(value).length > 0);
const idSchema = z.string().uuid();

function invalidRequest(res: Response): void {
  res.status(400).json({ error: { code: "INVALID_REQUEST", message: "Request validation failed." } });
}

function invalidUrl(res: Response): void {
  res.status(400).json({ error: { code: "INVALID_URL", message: "URL must use HTTPS and resolve exclusively to public IP addresses." } });
}

function getProjectId(req: Request, res: Response): string | undefined {
  const projectId = req.authenticatedProject?.id;
  if (!projectId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "A valid bearer API key is required." } });
  }
  return projectId;
}

export async function listEndpointsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  const projectId = getProjectId(req, res);
  if (!projectId) return;
  try {
    res.status(200).json({ data: await listEndpoints(projectId) });
  } catch (error) {
    next(error);
  }
}

export async function createEndpointController(req: Request, res: Response, next: NextFunction): Promise<void> {
  const projectId = getProjectId(req, res);
  const parsed = createEndpointSchema.safeParse(req.body);
  if (!projectId) return;
  if (!parsed.success) return invalidRequest(res);

  try {
    res.status(201).json(await createEndpoint(projectId, parsed.data));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("URL ")) return invalidUrl(res);
    next(error);
  }
}

export async function getEndpointController(req: Request, res: Response, next: NextFunction): Promise<void> {
  const projectId = getProjectId(req, res);
  const id = idSchema.safeParse(req.params.id);
  if (!projectId) return;
  if (!id.success) return invalidRequest(res);

  try {
    const endpoint = await getEndpoint(projectId, id.data);
    if (!endpoint) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Endpoint not found." } });
      return;
    }
    res.status(200).json(endpoint);
  } catch (error) {
    next(error);
  }
}

export async function updateEndpointController(req: Request, res: Response, next: NextFunction): Promise<void> {
  const projectId = getProjectId(req, res);
  const id = idSchema.safeParse(req.params.id);
  const parsed = updateEndpointSchema.safeParse(req.body);
  if (!projectId) return;
  if (!id.success || !parsed.success) return invalidRequest(res);

  try {
    const endpoint = await updateEndpoint(projectId, id.data, parsed.data);
    if (!endpoint) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Endpoint not found." } });
      return;
    }
    res.status(200).json(endpoint);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("URL ")) return invalidUrl(res);
    next(error);
  }
}

export async function deleteEndpointController(req: Request, res: Response, next: NextFunction): Promise<void> {
  const projectId = getProjectId(req, res);
  const id = idSchema.safeParse(req.params.id);
  if (!projectId) return;
  if (!id.success) return invalidRequest(res);

  try {
    const deleted = await softDeleteEndpoint(projectId, id.data);
    if (!deleted) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Endpoint not found." } });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}
