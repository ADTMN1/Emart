-- Add UPSERT as an audit mode without altering existing import records.
ALTER TYPE "ImportMode" ADD VALUE IF NOT EXISTS 'UPSERT';
