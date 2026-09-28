-- Promote every user who already has an APPROVED seller profile to SELLER so
-- the role agrees with the seller-application workflow that predates the role
-- column. PENDING/REJECTED applicants are deliberately left as CUSTOMER, and
-- only the store owner is touched (a buyer who merely ordered from a store is
-- unrelated and must stay a CUSTOMER).
UPDATE "users"
SET "role" = 'SELLER'
WHERE "role" = 'CUSTOMER'
  AND "id" IN (
    SELECT "userId" FROM "seller_profiles" WHERE "status" = 'APPROVED'
  );
