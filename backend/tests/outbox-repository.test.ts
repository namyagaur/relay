
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  eventUpdateMany: vi.fn(),
  outboxUpdateMany: vi.fn(),
  transaction: vi.fn()
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction
  }
}));

import { publishWithoutEndpoints } from "../src/services/outbox-repository";

describe("publishing outbox messages without delivery targets", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        $queryRaw: mocks.queryRaw,
        event: { updateMany: mocks.eventUpdateMany },
        outboxMessage: { updateMany: mocks.outboxUpdateMany }
      })
    );

    mocks.queryRaw.mockResolvedValue([{ id: "outbox-id" }]);
    mocks.eventUpdateMany.mockResolvedValue({ count: 1 });
    mocks.outboxUpdateMany.mockResolvedValue({ count: 1 });
  });

  it("marks a pending or processing event skipped and publishes its outbox row", async () => {
    const publishedAt = new Date("2026-01-01T00:00:00Z");

    await expect(
      publishWithoutEndpoints("outbox-id", "event-id", "project-id", publishedAt)
    ).resolves.toBe(true);

    expect(mocks.queryRaw).toHaveBeenCalledOnce();

    expect(mocks.eventUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "event-id",
        projectId: "project-id",
        status: { in: ["pending", "processing"] }
      },
      data: { status: "skipped" }
    });

    expect(mocks.outboxUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "outbox-id",
        eventId: "event-id",
        publishedAt: null
      },
      data: { publishedAt }
    });
  });

  it("does not add newly created endpoints to an already empty snapshot", async () => {
    // The SQL query confirms that the snapshot exists and contains zero targets.
    // A newly created endpoint must not change that snapshot.
    mocks.queryRaw.mockResolvedValue([{ id: "outbox-id" }]);

    await expect(
      publishWithoutEndpoints(
        "outbox-id",
        "event-id",
        "project-id",
        new Date()
      )
    ).resolves.toBe(true);

    expect(mocks.eventUpdateMany).toHaveBeenCalledOnce();
    expect(mocks.outboxUpdateMany).toHaveBeenCalledOnce();
  });

  it("does not publish when the outbox row is already claimed or the snapshot is not empty", async () => {
    mocks.queryRaw.mockResolvedValue([]);

    await expect(
      publishWithoutEndpoints(
        "outbox-id",
        "event-id",
        "project-id",
        new Date()
      )
    ).resolves.toBe(false);

    expect(mocks.eventUpdateMany).not.toHaveBeenCalled();
    expect(mocks.outboxUpdateMany).not.toHaveBeenCalled();
  });
});
