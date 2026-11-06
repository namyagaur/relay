-- CreateTable
CREATE TABLE "delivery_targets" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "endpointId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_targets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "delivery_targets_endpointId_idx" ON "delivery_targets"("endpointId");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_targets_eventId_endpointId_key" ON "delivery_targets"("eventId", "endpointId");

-- AddForeignKey
ALTER TABLE "delivery_targets" ADD CONSTRAINT "delivery_targets_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_targets" ADD CONSTRAINT "delivery_targets_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "endpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
