/// <reference path="../types/express.d.ts" />
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { getDeliveryDetails, listDeliveries } from "../services/delivery-service";

const deliveryIdSchema = z.string().uuid();
const deliveryListQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  status: z.enum(["delivered", "retrying", "failed", "skipped"]).optional(),
  eventId: z.string().uuid().optional(),
  endpointId: z.string().uuid().optional()
}).strict();

function invalidRequest(res: Response): void {
  res.status(400).json({ error: { code: "INVALID_REQUEST", message: "Request validation failed." } });
}

function getProjectId(req: Request, res: Response): string | undefined {
  const projectId = req.authenticatedProject?.id;
  if (!projectId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "A valid bearer API key is required." } });
  }
  return projectId;
}

export async function listDeliveriesController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const projectId = getProjectId(req, res);
  const parsedQuery = deliveryListQuerySchema.safeParse(req.query);
  if (!projectId) return;
  if (!parsedQuery.success) return invalidRequest(res);

  try {
    const result = await listDeliveries(projectId, {
      ...parsedQuery.data,
      limit: parsedQuery.data.limit ?? 20
    });
    if (!result) {
      invalidRequest(res);
      return;
    }
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function getDeliveryController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const projectId = getProjectId(req, res);
  const parsedId = deliveryIdSchema.safeParse(req.params.id);
  if (!projectId) return;
  if (!parsedId.success) return invalidRequest(res);

  try {
    const delivery = await getDeliveryDetails(projectId, parsedId.data);
    if (!delivery) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Delivery not found." } });
      return;
    }
    res.status(200).json(delivery);
  } catch (error) {
    next(error);
  }
}
