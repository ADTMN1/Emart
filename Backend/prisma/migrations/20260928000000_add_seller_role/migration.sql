-- EMART role separation: SELLER is a first-class account role.
--
-- Kept in its own migration on purpose. PostgreSQL refuses to use a value
-- added by ALTER TYPE ... ADD VALUE inside the same transaction that added
-- it ("unsafe use of new value"), so the backfill of already-approved sellers
-- lives in the following migration.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'SELLER';
