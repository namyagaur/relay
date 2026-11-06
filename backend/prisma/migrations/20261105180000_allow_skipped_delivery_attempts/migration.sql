DROP TRIGGER IF EXISTS "delivery_attempts_require_deliverable_endpoint"
ON "delivery_attempts";

CREATE OR REPLACE FUNCTION "ensure_endpoint_is_deliverable"()
RETURNS TRIGGER AS $$
DECLARE
    endpoint_eligible BOOLEAN;
BEGIN
    SELECT "isActive" AND "deletedAt" IS NULL
    INTO endpoint_eligible
    FROM "endpoints"
    WHERE "id" = NEW."endpointId"
    FOR UPDATE;

    IF endpoint_eligible IS DISTINCT FROM TRUE
        AND NEW."status" <> 'skipped' THEN
        RAISE EXCEPTION 'Delivery attempts require an active, non-deleted endpoint unless skipped.'
            USING ERRCODE = 'check_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "delivery_attempts_require_deliverable_endpoint"
BEFORE INSERT OR UPDATE OF "endpointId", "status" ON "delivery_attempts"
FOR EACH ROW
EXECUTE FUNCTION "ensure_endpoint_is_deliverable"();