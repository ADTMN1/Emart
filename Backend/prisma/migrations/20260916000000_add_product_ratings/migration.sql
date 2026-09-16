-- AddProductRatings: authenticated user ratings (1-5) per product, plus
-- denormalized average/count columns on products for fast list rendering.

-- 1. Ratings table. The (userId, productId) unique index enforces
--    one-rating-per-user-per-product; re-rating is an UPDATE (upsert).
CREATE TABLE "product_ratings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_ratings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_ratings_userId_productId_key" ON "product_ratings"("userId", "productId");
CREATE INDEX "product_ratings_productId_idx" ON "product_ratings"("productId");
CREATE INDEX "product_ratings_userId_idx" ON "product_ratings"("userId");

ALTER TABLE "product_ratings" ADD CONSTRAINT "product_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_ratings" ADD CONSTRAINT "product_ratings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Denormalized aggregates on products (kept in sync by the rating API on
--    every write). Default 0 = "no ratings yet" — no fake values seeded.
ALTER TABLE "products" ADD COLUMN "ratingAgg" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "products" ADD COLUMN "ratingCount" INTEGER NOT NULL DEFAULT 0;
