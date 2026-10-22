-- Add interest and penalty fields to loan_requests table
ALTER TABLE "loan_requests" ADD COLUMN "interestRate" DOUBLE PRECISION NOT NULL DEFAULT 0.001;
ALTER TABLE "loan_requests" ADD COLUMN "interestAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "loan_requests" ADD COLUMN "totalRepaymentBeforePenalties" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "loan_requests" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "loan_requests" ADD COLUMN "outstandingPrincipal" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "loan_requests" ADD COLUMN "accruedPenalty" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "loan_requests" ADD COLUMN "lastPenaltyCalculatedAt" TIMESTAMP(3);
ALTER TABLE "loan_requests" ADD COLUMN "fullyRepaidAt" TIMESTAMP(3);
ALTER TABLE "loan_requests" ADD COLUMN "principalRepaid" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "loan_requests" ADD COLUMN "interestRepaid" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "loan_requests" ADD COLUMN "penaltyRepaid" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Create index on dueDate for penalty calculation queries
CREATE INDEX "loan_requests_dueDate_idx" ON "loan_requests"("dueDate");

-- Backfill existing approved loans with calculated values
-- outstandingPrincipal = unpaid original principal (requestedAmount - principalRepaid)
-- For historical loans with no repayments yet, this equals requestedAmount
UPDATE "loan_requests"
SET
  "interestRate" = 0.001,
  "interestAmount" = ROUND("requestedAmount" * 0.001, 2),
  "totalRepaymentBeforePenalties" = ROUND("requestedAmount" * 1.001, 2),
  "outstandingPrincipal" = "requestedAmount",
  "dueDate" = CASE
    WHEN "repaymentPeriod" IS NOT NULL THEN "submittedAt" + ("repaymentPeriod" || ' months')::INTERVAL
    ELSE "submittedAt" + ('6 months')::INTERVAL
  END
WHERE "status" = 'APPROVED' AND "interestAmount" = 0;