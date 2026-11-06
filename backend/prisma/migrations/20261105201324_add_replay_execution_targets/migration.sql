-- AlterTable
ALTER TABLE "delivery_attempts" ADD COLUMN     "replayRequestId" UUID;

-- CreateTable
CREATE TABLE "replay_request_targets" (
    "id" UUID NOT NULL,
    "replayRequestId" UUID NOT NULL,
    "endpointId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),

    CONSTRAINT "replay_request_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "replay_request_targets_replayRequestId_status_idx" ON "replay_request_targets"("replayRequestId", "status");

-- CreateIndex
CREATE INDEX "replay_request_targets_endpointId_idx" ON "replay_request_targets"("endpointId");

-- CreateIndex
CREATE UNIQUE INDEX "replay_request_targets_replayRequestId_endpointId_key" ON "replay_request_targets"("replayRequestId", "endpointId");

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_replayRequestId_fkey" FOREIGN KEY ("replayRequestId") REFERENCES "replay_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replay_request_targets" ADD CONSTRAINT "replay_request_targets_replayRequestId_fkey" FOREIGN KEY ("replayRequestId") REFERENCES "replay_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "replay_request_targets" ADD CONSTRAINT "replay_request_targets_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "endpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
