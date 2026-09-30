-- Create SourceType enum
CREATE TYPE "SourceType" AS ENUM ('SELLER', 'CJ');

-- Add CJ supplier fields to products table
ALTER TABLE "products" ADD COLUMN "sourceType" "SourceType" NOT NULL DEFAULT 'SELLER';
ALTER TABLE "products" ADD COLUMN "externalProductId" TEXT;
ALTER TABLE "products" ADD COLUMN "supplierId" TEXT;
ALTER TABLE "products" ADD COLUMN "supplierData" JSONB;

-- Add unique constraint on externalProductId (for duplicate protection)
ALTER TABLE "products" ADD CONSTRAINT "products_externalProductId_key" UNIQUE ("externalProductId");

-- Add index on sourceType for filtering
CREATE INDEX "products_sourceType_idx" ON "products"("sourceType");