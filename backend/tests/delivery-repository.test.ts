
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  endpointFindFirst: vi.fn(),
  eventFindFirst: vi.fn(),
  eventUpdateMany: vi.fn(),
  deliveryTargetFindMany: vi.fn(),
  replayTargetFindFirst: vi.fn(),
  replayTargetUpdateMany: vi.fn(),
  replayTargetFindMany: vi.fn(),
  replayRequestUpdateMany: vi.fn(),
  queryRaw: vi.fn(),
  attemptCount: vi.fn(),
  attemptCreate: vi.fn(),
  attemptFindMany: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    endpoint: {
      findFirst: mocks.endpointFindFirst
    },
    event: {
      findFirst: mocks.eventFindFirst,
      updateMany: mocks.eventUpdateMany
    },
    deliveryAttempt: {
      count: mocks.attemptCount,
      create: mocks.attemptCreate,
      findMany: mocks.attemptFindMany
    },
    $transaction: mocks.transaction
  }
}));

import {
  beginReplayTarget,
  failReplayTarget,
  findDeliveryContext,
  isEndpointDeliverable,
  persistDeliveryAttempt
} from "../src/services/delivery-repository";

const eventId = "event-id";
const projectId = "project-id";
const endpointId = "endpoint-id";

describe("delivery repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        $queryRaw: mocks.queryRaw,
        deliveryTarget: {
          findMany: mocks.deliveryTargetFindMany
        },
        replayRequestTarget: {
          findFirst: mocks.replayTargetFindFirst,
          updateMany: mocks.replayTargetUpdateMany,
          findMany: mocks.replayTargetFindMany
        },
        replayRequest: { updateMany: mocks.replayRequestUpdateMany },
        deliveryAttempt: {
          count: mocks.attemptCount,
          create: mocks.attemptCreate,
          findMany: mocks.attemptFindMany
        },
        event: {
          findFirst: mocks.eventFindFirst,
          updateMany: mocks.eventUpdateMany
        }
      })
    );

    mocks.deliveryTargetFindMany.mockResolvedValue([{ endpointId }]);
    mocks.attemptCount.mockResolvedValue(0);
    mocks.attemptCreate.mockResolvedValue({});
    mocks.attemptFindMany.mockResolvedValue([]);
    mocks.queryRaw.mockResolvedValue([]);
    mocks.eventUpdateMany.mockResolvedValue({ count: 1 });
    mocks.eventFindFirst.mockResolvedValue({ projectId });
    mocks.replayTargetFindFirst.mockResolvedValue({ status: "processing" });
    mocks.replayTargetUpdateMany.mockResolvedValue({ count: 1 });
    mocks.replayTargetFindMany.mockResolvedValue([{ status: "completed" }]);
    mocks.replayRequestUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("scopes fresh endpoint and event loads by their project", async () => {
    mocks.endpointFindFirst.mockResolvedValue(null);
    mocks.eventFindFirst.mockResolvedValue(null);

    await findDeliveryContext(eventId, endpointId, projectId);

    expect(mocks.endpointFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: endpointId, projectId },
      select: expect.objectContaining({ url: true, encryptedSecret: true })
    }));

    expect(mocks.eventFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: eventId, projectId }
    }));
  });

  it("checks fresh endpoint deliverability with active and soft-delete predicates", async () => {
    mocks.endpointFindFirst.mockResolvedValue({ id: endpointId });

    await expect(isEndpointDeliverable(endpointId, projectId)).resolves.toBe(true);

    expect(mocks.endpointFindFirst).toHaveBeenCalledWith({
      where: { id: endpointId, projectId, isActive: true, deletedAt: null },
      select: { id: true }
    });
  });

  it.each([
    {
      prior: [
        { endpointId: "endpoint-1", status: "delivered" },
        { endpointId: "endpoint-id", status: "retrying" }
      ],
      current: "retrying",
      endpoints: ["endpoint-1", "endpoint-id"],
      expected: "processing"
    },
    {
      prior: [
        { endpointId: "endpoint-1", status: "delivered" },
        { endpointId: "endpoint-id", status: "failed" }
      ],
      current: "failed",
      endpoints: ["endpoint-1", "endpoint-id"],
      expected: "failed"
    },
    {
      prior: [{ endpointId: "endpoint-id", status: "delivered" }],
      current: "delivered",
      endpoints: ["endpoint-id"],
      expected: "delivered"
    },
    {
      prior: [{ endpointId: "endpoint-id", status: "skipped" }],
      current: "skipped",
      // The endpoint remains in the snapshot even if it is inactive.
      endpoints: ["endpoint-id"],
      expected: "skipped"
    }
  ])(
    "persists an attempt and transitions the event to $expected",
    async ({ prior, current, endpoints, expected }) => {
      mocks.deliveryTargetFindMany.mockResolvedValue(
        endpoints.map((id) => ({ endpointId: id }))
      );

      mocks.attemptFindMany.mockResolvedValue(prior);

      await persistDeliveryAttempt({
        eventId,
        projectId,
        endpointId,
        status: current as "delivered" | "retrying" | "failed" | "skipped",
        responseStatusCode: null,
        responseBody: null,
        errorMessage: null,
        durationMs: 42,
        attemptedAt: new Date("2026-01-01T00:00:00Z")
      });

      expect(mocks.queryRaw).toHaveBeenCalledOnce();

      expect(mocks.deliveryTargetFindMany).toHaveBeenCalledWith({
        where: { eventId },
        select: { endpointId: true }
      });

      expect(mocks.attemptCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          eventId,
          endpointId,
          attemptNumber: 1,
          status: current
        })
      }));

      expect(mocks.eventUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          id: eventId,
          projectId,
          status: { in: ["pending", "processing"] }
        },
        data: { status: expected }
      }));
    }
  );

  it("rejects delivery attempts for endpoints outside the event snapshot", async () => {
    mocks.deliveryTargetFindMany.mockResolvedValue([
      { endpointId: "another-endpoint" }
    ]);

    await expect(
      persistDeliveryAttempt({
        eventId,
        projectId,
        endpointId,
        status: "delivered",
        responseStatusCode: 200,
        responseBody: "",
        errorMessage: null,
        durationMs: 1,
        attemptedAt: new Date()
      })
    ).rejects.toThrow("Delivery attempt endpoint is not a target for this event.");

    expect(mocks.attemptCreate).not.toHaveBeenCalled();
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
  });

  it.each([
    {
      firstEndpoint: "endpoint-1",
      secondEndpoint: "endpoint-2",
      expected: ["processing", "delivered"]
    },
    {
      firstEndpoint: "endpoint-2",
      secondEndpoint: "endpoint-1",
      expected: ["processing", "delivered"]
    }
  ])(
    "completes endpoints in either order without premature delivery",
    async ({ firstEndpoint, secondEndpoint, expected }) => {
      let attempts: Array<{ endpointId: string; status: string }> = [];
      let transactionTail = Promise.resolve();

      mocks.transaction.mockImplementation((callback) => {
        const current = transactionTail.then(() => callback({
          $queryRaw: mocks.queryRaw,
          deliveryTarget: {
            findMany: vi.fn(async () => [
              { endpointId: "endpoint-1" },
              { endpointId: "endpoint-2" }
            ])
          },
          deliveryAttempt: {
            count: vi.fn(async ({ where }) =>
              attempts.filter((attempt) => attempt.endpointId === where.endpointId).length
            ),
            create: vi.fn(async ({ data }) => {
              attempts.push(data);
              return data;
            }),
            findMany: vi.fn(async () => attempts)
          },
          event: { updateMany: mocks.eventUpdateMany }
        }));

        transactionTail = current.then(() => undefined, () => undefined);
        return current;
      });

      for (const [index, endpoint] of [firstEndpoint, secondEndpoint].entries()) {
        await persistDeliveryAttempt({
          eventId,
          projectId,
          endpointId: endpoint,
          status: "delivered",
          responseStatusCode: 200,
          responseBody: "",
          errorMessage: null,
          durationMs: 1,
          attemptedAt: new Date(index)
        });

        expect(mocks.eventUpdateMany).toHaveBeenLastCalledWith(
          expect.objectContaining({
            data: { status: expected[index] }
          })
        );
      }
    }
  );

  it("keeps a final endpoint failure sticky when another endpoint succeeds later", async () => {
    let attempts: Array<{ endpointId: string; status: string }> = [];
    let eventStatus = "processing";

    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        $queryRaw: mocks.queryRaw,
        deliveryTarget: {
          findMany: vi.fn(async () => [
            { endpointId: "endpoint-1" },
            { endpointId: "endpoint-2" }
          ])
        },
        deliveryAttempt: {
          count: vi.fn(async ({ where }) =>
            attempts.filter((attempt) => attempt.endpointId === where.endpointId).length
          ),
          create: vi.fn(async ({ data }) => {
            attempts.push(data);
            return data;
          }),
          findMany: vi.fn(async () => attempts)
        },
        event: {
          updateMany: vi.fn(async ({ where, data }) => {
            if (where.status.in.includes(eventStatus)) {
              eventStatus = data.status;
            }
            return { count: 1 };
          })
        }
      })
    );

    await persistDeliveryAttempt({
      eventId,
      projectId,
      endpointId: "endpoint-1",
      status: "failed",
      responseStatusCode: 503,
      responseBody: null,
      errorMessage: "failed",
      durationMs: 1,
      attemptedAt: new Date(1)
    });

    await persistDeliveryAttempt({
      eventId,
      projectId,
      endpointId: "endpoint-2",
      status: "delivered",
      responseStatusCode: 200,
      responseBody: "",
      errorMessage: null,
      durationMs: 1,
      attemptedAt: new Date(2)
    });

    expect(eventStatus).toBe("failed");
  });

  it("serializes concurrent attempt persistence through the event row lock", async () => {
    const calls: string[] = [];
    let attempts: Array<{ endpointId: string; status: string }> = [];
    let tail = Promise.resolve();

    mocks.transaction.mockImplementation((callback) => {
      const current = tail.then(async () => callback({
        $queryRaw: vi.fn(async () => {
          calls.push("locked");
          return [];
        }),
        deliveryTarget: {
          findMany: vi.fn(async () => [
            { endpointId: "endpoint-1" },
            { endpointId: "endpoint-2" }
          ])
        },
        deliveryAttempt: {
          count: vi.fn(async ({ where }) =>
            attempts.filter((attempt) => attempt.endpointId === where.endpointId).length
          ),
          create: vi.fn(async ({ data }) => {
            attempts.push(data);
            calls.push(`created:${data.endpointId}`);
            return data;
          }),
          findMany: vi.fn(async () => attempts)
        },
        event: {
          updateMany: vi.fn(async () => ({ count: 1 }))
        }
      }));

      tail = current.then(() => undefined, () => undefined);
      return current;
    });

    await Promise.all(
      ["endpoint-1", "endpoint-2"].map((id) =>
        persistDeliveryAttempt({
          eventId,
          projectId,
          endpointId: id,
          status: "delivered",
          responseStatusCode: 200,
          responseBody: "",
          errorMessage: null,
          durationMs: 1,
          attemptedAt: new Date()
        })
      )
    );

    expect(calls.filter((call) => call === "locked")).toHaveLength(2);
    expect(attempts.map((attempt) => attempt.endpointId)).toEqual([
      "endpoint-1",
      "endpoint-2"
    ]);
  });

  it("persists replay attempts separately and completes the request without changing event status", async () => {
    await persistDeliveryAttempt({
      eventId,
      projectId,
      endpointId,
      replayRequestId: "replay-request-id",
      status: "delivered",
      responseStatusCode: 204,
      responseBody: "",
      errorMessage: null,
      durationMs: 12,
      attemptedAt: new Date("2026-11-06T00:00:00Z")
    });

    expect(mocks.attemptCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        replayRequestId: "replay-request-id",
        status: "delivered"
      })
    }));
    expect(mocks.replayTargetUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: "completed", completedAt: new Date("2026-11-06T00:00:00Z") }
    }));
    expect(mocks.replayRequestUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "replay-request-id", status: { in: ["pending", "processing"] } },
      data: { status: "completed", completedAt: new Date("2026-11-06T00:00:00Z") }
    }));
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
  });

  it("skips already terminal replay targets and marks exhausted worker failures", async () => {
    mocks.replayTargetFindFirst.mockResolvedValueOnce({ status: "completed" });
    await expect(beginReplayTarget("replay-request-id", eventId, endpointId)).resolves.toBe(false);
    expect(mocks.replayTargetUpdateMany).not.toHaveBeenCalled();

    mocks.replayTargetFindFirst.mockResolvedValueOnce({ status: "processing" });
    mocks.replayTargetFindMany.mockResolvedValueOnce([{ status: "failed" }]);
    await failReplayTarget("replay-request-id", eventId, endpointId);

    expect(mocks.attemptCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        replayRequestId: "replay-request-id",
        status: "failed",
        errorMessage: "Replay delivery worker exhausted its retry attempts."
      })
    }));
    expect(mocks.replayRequestUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "failed", failedAt: expect.any(Date) })
    }));
    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
  });
});
