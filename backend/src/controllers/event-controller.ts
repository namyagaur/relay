/// <reference path="../types/express.d.ts" />
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import type { Prisma } from "../generated/prisma/client";
import { getEventDetails, ingestEvent, listEvents } from "../services/event-service";
import { createReplayRequest } from "../services/replay-service";

const eventSchema = z.object({
  eventType: z.string().trim().min(1).max(255),
  payload: z.record(z.string(), z.unknown())
}).strict();
const idempotencyKeySchema = z.string().trim().min(1).max(255);
const eventIdSchema = z.string().uuid();
const eventListQuerySchema = z.object({
  cursor: z.string().uuid().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(100)).optional(),
  status: z.enum(["pending", "processing", "delivered", "failed", "skipped"]).optional()
}).strict();

function invalidRequest(res: Response): void {
  res.status(400).json({ error: { code: "INVALID_REQUEST", message: "Request validation failed." } });
}

export async function ingestEventController(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsedBody = eventSchema.safeParse(req.body);
  const rawIdempotencyKey = req.get("Idempotency-Key");
  const parsedIdempotencyKey = rawIdempotencyKey === undefined
    ? undefined
    : idempotencyKeySchema.safeParse(rawIdempotencyKey);
  const projectId = req.authenticatedProject?.id;

  if (!projectId || !parsedBody.success || (parsedIdempotencyKey && !parsedIdempotencyKey.success)) {
    invalidRequest(res);
    return;
  }

  try {
    const result = await ingestEvent(projectId, {
      ...parsedBody.data,
      payload: parsedBody.data.payload as Prisma.InputJsonObject,
      idempotencyKey: parsedIdempotencyKey?.data
    });
    res.status(result.duplicate ? 200 : 201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listEventsController(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsedQuery = eventListQuerySchema.safeParse(req.query);
  const projectId = req.authenticatedProject?.id;

  if (!projectId || !parsedQuery.success) {
    invalidRequest(res);
    return;
  }

  try {
    const result = await listEvents(projectId, {
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

export async function getEventController(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsedId = eventIdSchema.safeParse(req.params.id);
  const projectId = req.authenticatedProject?.id;

  if (!projectId || !parsedId.success) {
    invalidRequest(res);
    return;
  }

  try {
    const event = await getEventDetails(projectId, parsedId.data);
    if (!event) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found." } });
      return;
    }
    res.status(200).json(event);
  } catch (error) {
    next(error);
  }
}

export async function replayEventController(req: Request, res: Response, next: NextFunction): Promise<void> {
  const parsedId = eventIdSchema.safeParse(req.params.id);
  const projectId = req.authenticatedProject?.id;

  if (!projectId || !parsedId.success) {
    invalidRequest(res);
    return;
  }

  try {
    const result = await createReplayRequest(projectId, parsedId.data);
    if (result.kind === "not_found") {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found." } });
      return;
    }
    if (result.kind === "not_replayable") {
      res.status(409).json({ error: { code: "EVENT_NOT_REPLAYABLE", message: "Event has no failed deliveries eligible for replay." } });
      return;
    }
    res.status(202).json({
      replayRequestId: result.replayRequest.id,
      status: result.replayRequest.status
    });
  } catch (error) {
    next(error);
  }
}
