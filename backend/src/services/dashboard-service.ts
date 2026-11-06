import { prisma } from "../config/prisma";

function percentage(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(2));
}

function countsByStatus(groups: Array<{ status: string; _count: { _all: number } }>): Map<string, number> {
  return new Map(groups.map((group) => [group.status, group._count._all]));
}

export async function getDashboardStats(projectId: string) {
  const [eventGroups, endpointCount, attemptGroups] = await Promise.all([
    prisma.event.groupBy({
      by: ["status"],
      where: { projectId },
      _count: { _all: true }
    }),
    prisma.endpoint.count({
      where: { projectId, isActive: true, deletedAt: null }
    }),
    prisma.deliveryAttempt.groupBy({
      by: ["status"],
      where: { event: { projectId } },
      _count: { _all: true }
    })
  ]);
  const eventCounts = countsByStatus(eventGroups);
  const attemptCounts = countsByStatus(attemptGroups);
  const totalEvents = [...eventCounts.values()].reduce((sum, count) => sum + count, 0);
  const totalDeliveryAttempts = [...attemptCounts.values()].reduce((sum, count) => sum + count, 0);
  const deliveredAttempts = attemptCounts.get("delivered") ?? 0;
  const failedAttempts = attemptCounts.get("failed") ?? 0;

  return {
    totalEvents,
    deliveredEvents: eventCounts.get("delivered") ?? 0,
    failedEvents: eventCounts.get("failed") ?? 0,
    pendingProcessingEvents: (eventCounts.get("pending") ?? 0) + (eventCounts.get("processing") ?? 0),
    activeEndpoints: endpointCount,
    totalDeliveryAttempts,
    successRate: percentage(deliveredAttempts, totalDeliveryAttempts),
    failureRate: percentage(failedAttempts, totalDeliveryAttempts)
  };
}

export async function getDashboardActivity(projectId: string, limit: number) {
  const [events, deliveryAttempts] = await Promise.all([
    prisma.event.findMany({
      where: { projectId },
      select: { id: true, eventType: true, status: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit
    }),
    prisma.deliveryAttempt.findMany({
      where: { event: { projectId } },
      select: {
        id: true,
        attemptNumber: true,
        status: true,
        responseStatusCode: true,
        durationMs: true,
        attemptedAt: true,
        replayRequestId: true,
        event: { select: { id: true, eventType: true } },
        endpoint: { select: { id: true } }
      },
      orderBy: [{ attemptedAt: "desc" }, { id: "desc" }],
      take: limit
    })
  ]);
  return { events, deliveryAttempts };
}

export type DeliveryHealthWindow = "24h" | "7d" | "30d";

const WINDOW_MS: Record<DeliveryHealthWindow, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000
};

export async function getDashboardDeliveryHealth(
  projectId: string,
  window: DeliveryHealthWindow,
  now = new Date()
) {
  const attemptGroups = await prisma.deliveryAttempt.groupBy({
    by: ["status"],
    where: {
      event: { projectId },
      attemptedAt: { gte: new Date(now.getTime() - WINDOW_MS[window]) }
    },
    _count: { _all: true }
  });
  const counts = countsByStatus(attemptGroups);
  const delivered = counts.get("delivered") ?? 0;
  const failed = counts.get("failed") ?? 0;
  const denominator = delivered + failed;

  return {
    window,
    delivered: counts.get("delivered") ?? 0,
    failed: counts.get("failed") ?? 0,
    retrying: counts.get("retrying") ?? 0,
    pending: counts.get("pending") ?? 0,
    successRate: percentage(delivered, denominator)
  };
}
