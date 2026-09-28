-- Separate "notification was seen" from "order request was acted on".
--
-- Background
-- ----------
-- An ORDER_REQUEST row IS the order-request record: there is no OrderRequest
-- table, and `POST /seller/order-requests/:id/confirm` is keyed by the
-- notification id. Previously the row's `readAt` column carried BOTH meanings,
-- so the seller request queue (which selected `readAt IS NULL`) treated
-- "opened the notification" as "accepted the work" — and the navbar bell, which
-- marks notifications read on click, silently retired pending requests.
--
-- This migration introduces an explicit decision state. It performs NO
-- deletions: the pre-existing duplicate ORDER_REQUEST rows are left untouched.
-- Its DDL and backfill were applied to the live database by hand before the
-- migration was recorded, so every statement here is idempotent and re-running
-- it is a no-op.
-- (see the companion note in 20260930090100_add_order_request_unique_index,
-- which is deliberately NOT applied until that data is reviewed).

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "requestStatus" TEXT;
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "requestRespondedAt" TIMESTAMP(3);

-- Backfill legacy ORDER_REQUEST rows so the seller queue does not go blank.
--
--   readAt IS NULL  -> PENDING : the seller never acted on it (it was merely
--                                unopened), so it is a genuine open request.
--   readAt IS NOT NULL -> ACCEPTED : `confirmOrderRequest` was the only
--                                intentional writer of readAt for this type, so
--                                a read row is treated as already handled. The
--                                bell bug could also mark it read; the two are
--                                indistinguishable after the fact, so ACCEPTED
--                                is the conservative choice (it does not put
--                                already-handled work back in front of a seller).
--
-- The `AND "requestStatus" IS NULL` guard makes this backfill re-runnable.
--
-- No other type is touched: requestStatus stays NULL everywhere else.
UPDATE "notifications"
SET "requestStatus" = CASE WHEN "readAt" IS NULL THEN 'PENDING' ELSE 'ACCEPTED' END,
    "requestRespondedAt" = CASE WHEN "readAt" IS NULL THEN NULL ELSE "readAt" END
WHERE "type" = 'ORDER_REQUEST'
  AND "orderId" IS NOT NULL
  AND "requestStatus" IS NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notifications_userId_type_requestStatus_idx"
    ON "notifications"("userId", "type", "requestStatus");
