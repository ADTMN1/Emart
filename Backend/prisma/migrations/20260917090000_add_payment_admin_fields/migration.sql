-- Phase 3: admin payment management
-- Additive-only: two nullable columns on orders. No data is modified or removed.

ALTER TABLE "orders" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN "paymentNote" TEXT;
