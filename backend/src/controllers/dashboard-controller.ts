/// <reference path="../types/express.d.ts" />
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  getDashboardActivity,
  getDashboardDeliveryHealth,
  getDashboardStats
} from "../services/dashboard-service";

const activityQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(50)).optional()
}).strict();

const deliveryHealthQuerySchema = z.object({
  window: z.enum(["24h", "7d", "30d"]).optional()
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

export async function dashboardStatsController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const projectId = getProjectId(req, res);
  if (!projectId) return;

  try {
    res.status(200).json({ data: await getDashboardStats(projectId) });
  } catch (error) {
    next(error);
  }
}

export async function dashboardActivityController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const projectId = getProjectId(req, res);
  const parsedQuery = activityQuerySchema.safeParse(req.query);
  if (!projectId) return;
  if (!parsedQuery.success) return invalidRequest(res);

  try {
    res.status(200).json({
      data: await getDashboardActivity(projectId, parsedQuery.data.limit ?? 10)
    });
  } catch (error) {
    next(error);
  }
}

export async function dashboardDeliveryHealthController(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const projectId = getProjectId(req, res);
  const parsedQuery = deliveryHealthQuerySchema.safeParse(req.query);
  if (!projectId) return;
  if (!parsedQuery.success) return invalidRequest(res);

  try {
    res.status(200).json({
      data: await getDashboardDeliveryHealth(projectId, parsedQuery.data.window ?? "24h")
    });
  } catch (error) {
    next(error);
  }
}
