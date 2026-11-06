
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../config/prisma";

interface OutboxEndpoint {
  id: string;
  url: string;
}

interface UnpublishedOutboxMessage {
  id: string;
  eventId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  event: {
    projectId: string;
    project: { endpoints: OutboxEndpoint[] };
  };
}

export async function findUnpublishedOutboxMessages(
  batchSize: number
): Promise<UnpublishedOutboxMessage[]> {
  return prisma.$transaction(async (transaction) => {
    // Lock selected messages so multiple dispatchers cannot
    // create different target snapshots for the same event.
    const lockedMessages = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "outbox_messages"
      WHERE "publishedAt" IS NULL
      ORDER BY "createdAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    `;

    const results: UnpublishedOutboxMessage[] = [];

    for (const locked of lockedMessages) {
      const message = await transaction.outboxMessage.findUnique({
        where: { id: locked.id },
        select: {
          id: true,
          eventId: true,
          eventType: true,
          payload: true,
          targetsSnapshottedAt: true,
          event: {
            select: {
              projectId: true
            }
          }
        }
      });

      if (!message) continue;

      // Snapshot eligible endpoints exactly once.
      // A timestamp distinguishes an empty snapshot from an
      // event that has not been snapshotted yet.
      if (message.targetsSnapshottedAt === null) {
        const endpoints = await transaction.endpoint.findMany({
          where: {
            projectId: message.event.projectId,
            isActive: true,
            deletedAt: null
          },
          select: { id: true }
        });

        if (endpoints.length > 0) {
          await transaction.deliveryTarget.createMany({
            data: endpoints.map((endpoint) => ({
              eventId: message.eventId,
              endpointId: endpoint.id
            }))
          });
        }

        await transaction.outboxMessage.update({
          where: { id: message.id },
          data: { targetsSnapshottedAt: new Date() }
        });
      }

      // Always load saved targets, never current active endpoints.
      const targets = await transaction.deliveryTarget.findMany({
        where: { eventId: message.eventId },
        select: {
          endpoint: {
            select: {
              id: true,
              url: true
            }
          }
        }
      });

      results.push({
        id: message.id,
        eventId: message.eventId,
        eventType: message.eventType,
        payload: message.payload,
        event: {
          projectId: message.event.projectId,
          project: {
            endpoints: targets.map((target) => target.endpoint)
          }
        }
      });
    }

    return results;
  }, {
  maxWait: 10_000,
  timeout: 20_000
});
}

export async function markOutboxMessagePublished(
  id: string,
  publishedAt: Date
): Promise<boolean> {
  const result = await prisma.outboxMessage.updateMany({
    where: { id, publishedAt: null },
    data: { publishedAt }
  });

  return result.count > 0;
}

export async function publishWithoutEndpoints(
  outboxMessageId: string,
  eventId: string,
  projectId: string,
  publishedAt: Date
): Promise<boolean> {
  return prisma.$transaction(async (transaction) => {
    // Only publish an event if its snapshot is complete
    // and contains zero targets.
    const [locked] = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "outbox_messages"."id"
      FROM "outbox_messages"
      JOIN "events"
        ON "events"."id" = "outbox_messages"."eventId"
      WHERE "outbox_messages"."id" = ${outboxMessageId}::uuid
        AND "outbox_messages"."eventId" = ${eventId}::uuid
        AND "events"."projectId" = ${projectId}::uuid
        AND "outbox_messages"."publishedAt" IS NULL
        AND "outbox_messages"."targetsSnapshottedAt" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM "delivery_targets"
          WHERE "delivery_targets"."eventId" = "outbox_messages"."eventId"
        )
      FOR UPDATE OF "outbox_messages"
    `;

    if (!locked) return false;

    await transaction.event.updateMany({
      where: {
        id: eventId,
        projectId,
        status: { in: ["pending", "processing"] }
      },
      data: { status: "skipped" }
    });

    const updated = await transaction.outboxMessage.updateMany({
      where: {
        id: outboxMessageId,
        eventId,
        publishedAt: null
      },
      data: { publishedAt }
    });

    return updated.count > 0;
  });
}
