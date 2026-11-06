import { prisma } from "../config/prisma";
import type { ReplayDispatcherRepository } from "./replay-dispatcher";

export async function findDispatchableReplayRequests(batchSize: number) {
  const requests = await prisma.replayRequest.findMany({
    where: { status: { in: ["pending", "processing"] } },
    orderBy: { createdAt: "asc" },
    take: batchSize,
    select: {
      id: true,
      eventId: true,
      event: {
        select: {
          projectId: true,
          eventType: true,
          payload: true
        }
      },
      targets: {
        where: { status: { in: ["pending", "processing"] } },
        select: {
          endpointId: true,
          endpoint: { select: { url: true } }
        }
      }
    }
  });

  return requests.map((request) => ({
    id: request.id,
    eventId: request.eventId,
    projectId: request.event.projectId,
    eventType: request.event.eventType,
    payload: request.event.payload,
    targets: request.targets.map((target) => ({
      endpointId: target.endpointId,
      endpointUrl: target.endpoint.url
    }))
  }));
}

export const prismaReplayDispatcherRepository: ReplayDispatcherRepository = {
  findDispatchable: findDispatchableReplayRequests
};
