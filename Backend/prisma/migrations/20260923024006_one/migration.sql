-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "paymentProofUrl" TEXT;

-- AlterTable
ALTER TABLE "seller_applications" ADD COLUMN     "address" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "email" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "emergencyContact" TEXT,
ADD COLUMN     "idDocumentMimeType" TEXT,
ADD COLUMN     "idDocumentPath" TEXT NOT NULL DEFAULT '',
ALTER COLUMN "storeDescription" SET DEFAULT '';
