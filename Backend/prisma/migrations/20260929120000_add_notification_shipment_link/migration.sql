-- Add a nullable shipment link to notifications.
--
-- The Notification model was missing the `shipmentId` column that
-- ShipmentService already passes to NotificationService.create(), which made
-- every shipment lifecycle notification fail with PrismaClientValidationError
-- ("Unknown argument `shipmentId`") *after* the shipment write had committed.
--
-- The column is nullable so existing rows are untouched, and the FK cascades so
-- a deleted shipment can never leave a notification pointing at a missing row.

-- All three statements are written idempotently (IF NOT EXISTS / a guarded
-- DO block) because this DDL has already been applied to the live database by
-- hand, while the migration itself was never recorded. Re-running it must be a
-- no-op so `migrate deploy` can reconcile the history instead of failing on an
-- existing column. Postgres has no "ADD CONSTRAINT IF NOT EXISTS", hence the
-- guard.

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "shipmentId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_shipmentId_idx" ON "notifications"("shipmentId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notifications_shipmentId_fkey'
  ) THEN
    ALTER TABLE "notifications"
      ADD CONSTRAINT "notifications_shipmentId_fkey"
      FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
