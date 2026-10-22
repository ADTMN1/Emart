-- CreateEnum
CREATE TYPE "LoanRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "loan_requests" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "requestedAmount" DOUBLE PRECISION NOT NULL,
    "loanPurpose" TEXT NOT NULL,
    "repaymentPeriod" INTEGER,
    "status" "LoanRequestStatus" NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByAdminId" TEXT,
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "loan_requests_customerId_idx"
ON "loan_requests"("customerId");

-- CreateIndex
CREATE INDEX "loan_requests_status_idx"
ON "loan_requests"("status");

-- CreateIndex
CREATE INDEX "loan_requests_submittedAt_idx"
ON "loan_requests"("submittedAt");

-- AddForeignKey
ALTER TABLE "loan_requests"
ADD CONSTRAINT "loan_requests_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_requests"
ADD CONSTRAINT "loan_requests_reviewedByAdminId_fkey"
FOREIGN KEY ("reviewedByAdminId") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
