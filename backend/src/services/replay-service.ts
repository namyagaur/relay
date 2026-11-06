import { prisma } from "../config/prisma";

export type CreateReplayRequestResult =
  | { kind: "not_found" }
  | { kind: "not_replayable" }
  | { kind: "created"; replayRequest: { id: string; status: string } };

export async function createReplayRequest(
  projectId: string,
  eventId: string
): Promise<CreateReplayRequestResult> {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "events"
      WHERE "id" = ${eventId}::uuid
        AND "projectId" = ${projectId}::uuid
      FOR UPDATE
    `;

    const event = await transaction.event.findFirst({
      where: { id: eventId, projectId },
      select: {
        id: true,
        status: true,
        deliveryTargets: {
          select: {
            endpointId: true,
            endpoint: { select: { isActive: true, deletedAt: true } }
          }
        }
      }
    });
    if (!event) return { kind: "not_found" };
    if (event.status !== "failed") return { kind: "not_replayable" };

    const attempts = await transaction.deliveryAttempt.findMany({
      where: { eventId },
      orderBy: [{ attemptNumber: "desc" }, { attemptedAt: "desc" }],
      select: { endpointId: true, status: true }
    });
    const latestStatus = new Map<string, string>();
    for (const attempt of attempts) {
      if (!latestStatus.has(attempt.endpointId)) {
        latestStatus.set(attempt.endpointId, attempt.status);
      }
    }

    const failedEndpointIds = event.deliveryTargets
      .filter(({ endpointId, endpoint }) =>
        endpoint.isActive &&
        endpoint.deletedAt === null &&
        latestStatus.get(endpointId) === "failed"
      )
      .map(({ endpointId }) => endpointId);
    if (failedEndpointIds.length === 0) return { kind: "not_replayable" };

    const replayRequest = await transaction.replayRequest.create({
      data: {
        eventId,
        status: "pending",
        targets: {
          create: failedEndpointIds.map((endpointId) => ({ endpointId }))
        }
      },
      select: { id: true, status: true }
    });
    return { kind: "created", replayRequest };
  });
}
