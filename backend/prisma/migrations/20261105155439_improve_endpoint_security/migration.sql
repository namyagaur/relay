DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "endpoints") THEN
        RAISE EXCEPTION 'Endpoint rows exist; encrypt their secrets before applying this migration.';
    END IF;
END
$$;

-- DropForeignKey
ALTER TABLE "delivery_attempts" DROP CONSTRAINT "delivery_attempts_endpointId_fkey";

-- DropIndex
DROP INDEX "endpoints_projectId_idx";

-- AlterTable
ALTER TABLE "endpoints" RENAME COLUMN "secret" TO "encryptedSecret";

-- AlterTable
ALTER TABLE "endpoints" ADD COLUMN "deletedAt" TIMESTAMPTZ(6);

-- Reject values that are not in the versioned AES-256-GCM storage format.
ALTER TABLE "endpoints"
ADD CONSTRAINT "endpoints_encryptedSecret_format_check"
CHECK ("encryptedSecret" ~ '^v1:[A-Za-z0-9+/]{16}:[A-Za-z0-9+/]{22}==:[A-Za-z0-9+/]*={0,2}$');

-- AlterTable
ALTER TABLE "events" ALTER COLUMN "idempotencyKey" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "endpoints_projectId_isActive_deletedAt_idx" ON "endpoints"("projectId", "isActive", "deletedAt");

-- AddForeignKey
ALTER TABLE "delivery_attempts" ADD CONSTRAINT "delivery_attempts_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "endpoints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "ensure_endpoint_is_deliverable"() RETURNS TRIGGER AS $$
DECLARE
    endpoint_eligible BOOLEAN;
BEGIN
    SELECT "isActive" AND "deletedAt" IS NULL
    INTO endpoint_eligible
    FROM "endpoints"
    WHERE "id" = NEW."endpointId"
    FOR UPDATE;

    IF endpoint_eligible IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Delivery attempts require an active, non-deleted endpoint.'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "delivery_attempts_require_deliverable_endpoint"
BEFORE INSERT OR UPDATE OF "endpointId" ON "delivery_attempts"
FOR EACH ROW
EXECUTE FUNCTION "ensure_endpoint_is_deliverable"();
