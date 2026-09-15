-- Separate receiving address for every supported crypto network.
CREATE TABLE "crypto_wallets" (
    "id" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "qrCodeUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crypto_wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "crypto_wallets_address_key" ON "crypto_wallets"("address");
CREATE UNIQUE INDEX "crypto_wallets_currency_network_key" ON "crypto_wallets"("currency", "network");
CREATE INDEX "crypto_wallets_isActive_currency_network_idx" ON "crypto_wallets"("isActive", "currency", "network");
