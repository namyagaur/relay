import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";

const deliveryListFields = {
  id: true,
  attemptNumber: true,
  status: true,
  responseStatusCode: true,
  errorMessage: true,
  durationMs: true,
  attemptedAt: true,
  replayRequestId: true,
  event: {
    select: { id: true, eventType: true }
  },
  endpoint: {
    select: { id: true, url: true }
  }
} satisfies Prisma.DeliveryAttemptSelect;

const deliveryDetailsFields = {
  id: true,
  attemptNumber: true,
  status: true,
  responseStatusCode: true,
  responseBody: true,
  errorMessage: true,
  durationMs: true,
  attemptedAt: true,
  replayRequestId: true,
  event: {
    select: { id: true, eventType: true, status: true, createdAt: true, payload: true }
  },
  endpoint: {
    select: { id: true, url: true, description: true, isActive: true, deletedAt: true }
  }
} satisfies Prisma.DeliveryAttemptSelect;

export type ListDeliveriesOptions = {
  cursor?: string;
  limit: number;
  status?: "delivered" | "retrying" | "failed" | "skipped";
  eventId?: string;
  endpointId?: string;
};

export async function listDeliveries(projectId: string, options: ListDeliveriesOptions) {
  if (options.cursor) {
    const cursorAttempt = await prisma.deliveryAttempt.findFirst({
      where: { id: options.cursor, event: { projectId } },
      select: { id: true }
    });
    if (!cursorAttempt) return null;
  }

  const attempts = await prisma.deliveryAttempt.findMany({
    where: {
      event: { projectId },
      ...(options.status ? { status: options.status } : {}),
      ...(options.eventId ? { eventId: options.eventId } : {}),
      ...(options.endpointId ? { endpointId: options.endpointId } : {})
    },
    select: deliveryListFields,
    orderBy: [{ attemptedAt: "desc" }, { id: "desc" }],
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    take: options.limit + 1
  });
  const hasMore = attempts.length > options.limit;
  const data = hasMore ? attempts.slice(0, options.limit) : attempts;

  return {
    data,
    pagination: {
      nextCursor: hasMore ? data[data.length - 1].id : null,
      hasMore
    }
  };
}

export async function getDeliveryDetails(projectId: string, deliveryId: string) {
  const delivery = await prisma.deliveryAttempt.findFirst({
    where: { id: deliveryId, event: { projectId } },
    select: deliveryDetailsFields
  });
  if (!delivery) return null;

  const attempts = await prisma.deliveryAttempt.findMany({
    where: { eventId: delivery.event.id, endpointId: delivery.endpoint.id },
    select: {
      id: true,
      attemptNumber: true,
      status: true,
      responseStatusCode: true,
      responseBody: true,
      errorMessage: true,
      durationMs: true,
      attemptedAt: true
    },
    orderBy: [{ attemptNumber: "asc" }, { attemptedAt: "asc" }]
  });
  return { ...delivery, attempts };
}
