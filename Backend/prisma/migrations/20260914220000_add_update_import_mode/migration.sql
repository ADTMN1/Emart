-- Permit partial CSV UPDATE import runs while preserving existing CREATE runs.
ALTER TYPE "ImportMode" ADD VALUE IF NOT EXISTS 'UPDATE';
