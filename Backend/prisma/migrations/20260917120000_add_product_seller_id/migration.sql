-- Phase 6: Seller-owned products (additive only).
-- Adds a nullable sellerId to products referencing seller_profiles.
-- null = admin/catalog product. No existing rows are modified.

-- AlterTable
ALTER TABLE "products" ADD COLUMN "sellerId" TEXT;

-- CreateIndex
CREATE INDEX "products_sellerId_updatedAt_idx" ON "products"("sellerId", "updatedAt");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "seller_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
