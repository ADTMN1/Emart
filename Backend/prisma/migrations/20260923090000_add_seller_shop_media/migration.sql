-- Phase 5 follow-up: seller storefront media (additive only).
-- Adds nullable logo/banner columns to seller_profiles. No existing
-- tables or data are modified.

-- AlterTable
ALTER TABLE "seller_profiles" ADD COLUMN "bannerPath" TEXT,
ADD COLUMN "bannerUrl" TEXT,
ADD COLUMN "logoPath" TEXT,
ADD COLUMN "logoUrl" TEXT;