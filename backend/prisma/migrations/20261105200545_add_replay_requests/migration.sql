-- CreateTable
CREATE TABLE "replay_requests" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "failedAt" TIMESTAMPTZ(6),

    CONSTRAINT "replay_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "replay_requests_eventId_createdAt_idx" ON "replay_requests"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "replay_requests_status_createdAt_idx" ON "replay_requests"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "replay_requests" ADD CONSTRAINT "replay_requests_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
