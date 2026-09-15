-- AddProductSku: nullable `sku` column, backfill unique values, then enforce uniqueness.
-- Kept nullable so existing products and existing create flows are unaffected (SKU is optional).

-- 1. Add the column (nullable, no constraint yet)
ALTER TABLE "products" ADD COLUMN "sku" TEXT;

-- 2. Backfill: deterministic, collision-free SKU per existing product.
--    'EM-' + hex chars of the product id mapped to 0-5, zero-padded to 10 chars.
--    Two distinct uuids share the same prefix only if their first 8 hex chars match,
--    so uniqueness is guaranteed by construction.
UPDATE "products"
SET "sku" = 'EM-' || lpad(
  upper(
    translate(
      substr(replace("id"::text, '-', ''), 1, 8),
      'abcdef',
      '012345'
    )
  ),
  10,
  '0'
);

-- 3. Enforce uniqueness (Prisma's naming for @unique) and give it a usable index
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
