-- Phase 8: Seller Agreement acceptance (additive only).
-- Adds a one-per-user acceptance record for the EMART Seller Agreement.
-- No existing tables or data are modified.

-- CreateTable
CREATE TABLE "seller_agreement_acceptances" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_agreement_acceptances_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_agreement_acceptances_userId_key" ON "seller_agreement_acceptances"("userId");

-- CreateIndex
CREATE INDEX "seller_agreement_acceptances_userId_idx" ON "seller_agreement_acceptances"("userId");

-- AddForeignKey
ALTER TABLE "seller_agreement_acceptances" ADD CONSTRAINT "seller_agreement_acceptances_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;