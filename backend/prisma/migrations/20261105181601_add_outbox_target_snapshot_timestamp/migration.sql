-- AlterTable
ALTER TABLE "outbox_messages" 
ADD COLUMN "targetsSnapshottedAt" TIMESTAMPTZ(6);
