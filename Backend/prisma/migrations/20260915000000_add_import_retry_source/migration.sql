-- Preserve raw import rows so failed CSV records can be retried without losing audit history.
ALTER TABLE "import_runs"
ADD COLUMN IF NOT EXISTS "sourceRows" JSONB;
