import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";

export interface DeliveryContext {
  endpoint: {
    id: string;
    projectId: string;
    url: string;
    encryptedSecret: string;
    isActive: boolean;
    deletedAt: Date | null;
  } | null;
  event: {
    id: string;
    projectId: string;
    eventType: string;
    payload: Prisma.JsonValue;
  } | null;
}

export interface PersistAttemptInput {
  eventId: string;
  projectId: string;
  endpointId: string;
  replayRequestId?: string;
  status: "delivered" | "retrying" | "failed" | "skipped";
  responseStatusCode: number | null;
  responseBody: string | null;
  errorMessage: string | null;
  durationMs: number;
  attemptedAt: Date;
}

export async function findDeliveryContext(
  eventId: string,
  endpointId: string,
  projectId: string
): Promise<DeliveryContext> {
  const [endpoint, event] = await Promise.all([
    prisma.endpoint.findFirst({
      where: { id: endpointId, projectId },
      select: {
        id: true,
        projectId: true,
        url: true,
        encryptedSecret: true,
        isActive: true,
        deletedAt: true
      }
    }),
    prisma.event.findFirst({
      where: { id: eventId, projectId },
      select: { id: true, projectId: true, eventType: true, payload: true }
    })
  ]);
  return { endpoint, event };
}

export async function markEventProcessing(eventId: string, projectId: string): Promise<void> {
  await prisma.event.updateMany({
    where: { id: eventId, projectId, status: { in: ["pending", "processing"] } },
    data: { status: "processing" }
  });
}

export async function isEndpointDeliverable(endpointId: string, projectId: string): Promise<boolean> {
  const endpoint = await prisma.endpoint.findFirst({
    where: { id: endpointId, projectId, isActive: true, deletedAt: null },
    select: { id: true }
  });
  return endpoint !== null;
}


export async function persistDeliveryAttempt(input: PersistAttemptInput): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    // Serialize status updates for this event.
    await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "events"
      WHERE "id" = ${input.eventId}::uuid
        AND "projectId" = ${input.projectId}::uuid
      FOR UPDATE
    `;

    // Only endpoints in the immutable snapshot can receive this event.
    const isReplay = input.replayRequestId !== undefined;
    let endpointIds: string[] = [];
    if (isReplay) {
      const target = await transaction.replayRequestTarget.findFirst({
        where: {
          replayRequestId: input.replayRequestId,
          endpointId: input.endpointId,
          replayRequest: { eventId: input.eventId }
        },
        select: { id: true }
      });
      if (!target) throw new Error("Replay attempt endpoint is not a target for this request.");
    } else {
      const targets = await transaction.deliveryTarget.findMany({
        where: { eventId: input.eventId },
        select: { endpointId: true }
      });
      endpointIds = targets.map((target) => target.endpointId);
      if (!targets.some((target) => target.endpointId === input.endpointId)) {
        throw new Error("Delivery attempt endpoint is not a target for this event.");
      }
    }

    const attemptNumber =
      (await transaction.deliveryAttempt.count({
        where: {
          eventId: input.eventId,
          endpointId: input.endpointId
        }
      })) + 1;

    await transaction.deliveryAttempt.create({
      data: {
        eventId: input.eventId,
        endpointId: input.endpointId,
        replayRequestId: input.replayRequestId,
        attemptNumber,
        status: input.status,
        responseStatusCode: input.responseStatusCode,
        responseBody: input.responseBody,
        errorMessage: input.errorMessage,
        durationMs: input.durationMs,
        attemptedAt: input.attemptedAt
      }
    });

    if (input.replayRequestId) {
      const targetStatus = input.status === "delivered"
        ? "completed"
        : input.status === "retrying"
          ? "processing"
          : input.status;
      await transaction.replayRequestTarget.updateMany({
        where: {
          replayRequestId: input.replayRequestId,
          endpointId: input.endpointId,
          status: { notIn: ["completed", "failed", "skipped"] }
        },
        data: {
          status: targetStatus,
          ...(targetStatus === "completed" || targetStatus === "failed" || targetStatus === "skipped"
            ? { completedAt: input.attemptedAt }
            : {})
        }
      });
      await refreshReplayRequestStatus(transaction, input.replayRequestId, input.attemptedAt);
      return;
    }

    // Read all attempts for this event.
    const attempts = await transaction.deliveryAttempt.findMany({
      where: { eventId: input.eventId, replayRequestId: null },
      orderBy: { attemptNumber: "asc" },
      select: { endpointId: true, status: true }
    });

    const latestStatus = new Map<string, string>();
    const failedEndpointIds = new Set<string>();

    for (const attempt of attempts) {
      latestStatus.set(attempt.endpointId, attempt.status);

      // A terminal failure remains sticky.
      if (attempt.status === "failed") {
        failedEndpointIds.add(attempt.endpointId);
      }
    }

    // Aggregate status using only the original delivery targets.
    const allTerminal = endpointIds.every((id) => {
      const status = latestStatus.get(id);
      return status === "delivered" || status === "failed" || status === "skipped";
    });

    const hasFailure = endpointIds.some((id) => failedEndpointIds.has(id));
    const hasDelivered = endpointIds.some((id) => latestStatus.get(id) === "delivered");

    const status = !allTerminal
      ? "processing"
      : hasFailure
        ? "failed"
        : hasDelivered
          ? "delivered"
          : "skipped";

    await transaction.event.updateMany({
      where: {
        id: input.eventId,
        projectId: input.projectId,
        status: { in: ["pending", "processing"] }
      },
      data: { status }
    });
  });
}

async function refreshReplayRequestStatus(
  transaction: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  replayRequestId: string,
  at: Date
): Promise<void> {
  const targets = await transaction.replayRequestTarget.findMany({
    where: { replayRequestId },
    select: { status: true }
  });
  const terminal = targets.every((target) =>
    target.status === "completed" || target.status === "failed" || target.status === "skipped"
  );
  const status = terminal
    ? targets.every((target) => target.status === "completed") ? "completed" : "failed"
    : "processing";
  await transaction.replayRequest.updateMany({
    where: { id: replayRequestId, status: { in: ["pending", "processing"] } },
    data: {
      status,
      ...(terminal && status === "completed" ? { completedAt: at } : {}),
      ...(terminal && status === "failed" ? { failedAt: at } : {})
    }
  });
}

export async function beginReplayTarget(
  replayRequestId: string,
  eventId: string,
  endpointId: string,
  at = new Date()
): Promise<boolean> {
  return prisma.$transaction(async (transaction) => {
    const target = await transaction.replayRequestTarget.findFirst({
      where: { replayRequestId, endpointId, replayRequest: { eventId } },
      select: { status: true, startedAt: true }
    });
    if (!target || ["completed", "failed", "skipped"].includes(target.status)) return false;

    await transaction.replayRequestTarget.updateMany({
      where: {
        replayRequestId,
        endpointId,
        status: { notIn: ["completed", "failed", "skipped"] }
      },
      data: { status: "processing", startedAt: target.startedAt ?? at }
    });
    await transaction.replayRequest.updateMany({
      where: { id: replayRequestId, status: { in: ["pending", "processing"] } },
      data: { status: "processing" }
    });
    await transaction.replayRequest.updateMany({
      where: { id: replayRequestId, startedAt: null, status: { in: ["pending", "processing"] } },
      data: { startedAt: at }
    });
    return true;
  });
}

export async function failReplayTarget(
  replayRequestId: string,
  eventId: string,
  endpointId: string,
  at = new Date()
): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "events"
      WHERE "id" = ${eventId}::uuid
      FOR UPDATE
    `;
    const [target, event] = await Promise.all([
      transaction.replayRequestTarget.findFirst({
        where: { replayRequestId, endpointId, replayRequest: { eventId } },
        select: { status: true }
      }),
      transaction.event.findFirst({ where: { id: eventId }, select: { projectId: true } })
    ]);
    if (!target || !event || ["completed", "failed", "skipped"].includes(target.status)) return;

    const attemptNumber = (await transaction.deliveryAttempt.count({
      where: { eventId, endpointId }
    })) + 1;
    await transaction.deliveryAttempt.create({
      data: {
        eventId,
        endpointId,
        replayRequestId,
        attemptNumber,
        status: "failed",
        errorMessage: "Replay delivery worker exhausted its retry attempts.",
        durationMs: 0,
        attemptedAt: at
      }
    });
    await transaction.replayRequestTarget.updateMany({
      where: {
        replayRequestId,
        endpointId,
        status: { notIn: ["completed", "failed", "skipped"] }
      },
      data: { status: "failed", completedAt: at }
    });
    await refreshReplayRequestStatus(transaction, replayRequestId, at);
  });
}


export const prismaDeliveryRepository = {
  findContext: findDeliveryContext,
  isEndpointDeliverable,
  markProcessing: markEventProcessing,
  persistAttempt: persistDeliveryAttempt,
  beginReplayTarget,
  failReplayTarget
};
