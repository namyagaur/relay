import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";

const eventFields = {
  id: true,
  projectId: true,
  idempotencyKey: true,
  eventType: true,
  payload: true,
  status: true,
  createdAt: true,
  updatedAt: true
} as const;

const listedEventFields = {
  id: true,
  eventType: true,
  payload: true,
  status: true,
  createdAt: true,
  updatedAt: true
} as const;

const eventDetailsFields = {
  id: true,
  eventType: true,
  payload: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  deliveryTargets: {
    select: { endpointId: true }
  },
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
} satisfies Prisma.EventSelect;

type EventInput = {
  eventType: string;
  payload: Prisma.InputJsonObject;
  idempotencyKey?: string;
};

export type ListEventsOptions = {
  cursor?: string;
  limit: number;
  status?: "pending" | "processing" | "delivered" | "failed" | "skipped";
};

function isUniqueConstraintError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

async function findExistingEvent(projectId: string, idempotencyKey: string) {
  return prisma.event.findUnique({
    where: { projectId_idempotencyKey: { projectId, idempotencyKey } },
    select: eventFields
  });
}

export async function ingestEvent(projectId: string, input: EventInput) {
  if (input.idempotencyKey) {
    const existing = await findExistingEvent(projectId, input.idempotencyKey);
    if (existing) return { event: existing, duplicate: true };
  }

  try {
    const event = await prisma.$transaction(async (transaction) => {
      const created = await transaction.event.create({
        data: {
          projectId,
          idempotencyKey: input.idempotencyKey,
          eventType: input.eventType,
          payload: input.payload,
          status: "pending"
        },
        select: eventFields
      });
      await transaction.outboxMessage.create({
        data: {
          eventId: created.id,
          eventType: created.eventType,
          payload: input.payload
        }
      });
      return created;
    });
    return { event, duplicate: false };
  } catch (error) {
    if (!input.idempotencyKey || !isUniqueConstraintError(error)) throw error;

    const existing = await findExistingEvent(projectId, input.idempotencyKey);
    if (existing) return { event: existing, duplicate: true };
    throw error;
  }
}

export async function listEvents(projectId: string, options: ListEventsOptions) {
  if (options.cursor) {
    const cursorEvent = await prisma.event.findFirst({
      where: { id: options.cursor, projectId },
      select: { id: true }
    });
    if (!cursorEvent) return null;
  }

  const events = await prisma.event.findMany({
    where: {
      projectId,
      ...(options.status ? { status: options.status } : {})
    },
    select: listedEventFields,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    take: options.limit + 1
  });
  const hasMore = events.length > options.limit;
  const data = hasMore ? events.slice(0, options.limit) : events;

  return {
    data,
    pagination: {
      nextCursor: hasMore ? data[data.length - 1].id : null,
      hasMore
    }
  };
}

export async function getEventDetails(projectId: string, eventId: string) {
  return prisma.event.findFirst({
    where: { id: eventId, projectId },
    select: eventDetailsFields
  });
}
