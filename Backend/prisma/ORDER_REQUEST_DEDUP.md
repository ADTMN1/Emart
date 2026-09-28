# Order-request duplicate cleanup + unique index (REQUIRES SIGN-OFF)

Status: **not applied.** Nothing in this file has been run against any database.

## Why this exists

`Notification` has no unique constraint of any kind, so the database cannot
prevent two `ORDER_REQUEST` rows for the same `(seller, order)`. The audit found
this had already happened in production.

Duplicate prevention is currently enforced in the application:
`sendOrderToSeller` (`Backend/src/controllers/message.controller.ts`) takes a
`pg_advisory_xact_lock` keyed on `userId + orderId` around its check-then-create,
so concurrent requests for the same order are serialised. That closes the
read-then-write race, but it is application-level only — it cannot protect
against a second code path, a manual insert, or rows that already exist.

This document covers the durable database-level backstop.

## Step 1 — review (read-only, safe to run)

```sql
SELECT n."userId", n."orderId", COUNT(*) AS copies,
       MIN(n."createdAt") AS first_created,
       MAX(n."createdAt") AS last_created
FROM "notifications" n
WHERE n."type" = 'ORDER_REQUEST' AND n."orderId" IS NOT NULL
GROUP BY 1, 2
HAVING COUNT(*) > 1
ORDER BY copies DESC;
```

Observed on the development database (13 notifications total):

| userId | orderId | copies |
| --- | --- | --- |
| `44df5a21-598a-4bfa-8517-75fb78d5179c` | `6619b145-922d-45d7-83d1-60d43cb49582` | 9 |

## Step 2 — deletion needs explicit approval

**Not performed.** No production notification record has been deleted. The
statement below is provided for review only. It keeps the **oldest** row per
`(userId, orderId)` and removes the later copies, because the surviving row is
the one a seller may already have confirmed against.

```sql
DELETE FROM "notifications" n
USING "notifications" keep
WHERE n."type" = 'ORDER_REQUEST'
  AND n."orderId" IS NOT NULL
  AND n."userId" = keep."userId"
  AND n."orderId" = keep."orderId"
  AND n."createdAt" > keep."createdAt";
```

Re-run the Step 1 query afterwards; it must return zero groups.

## Step 3 — apply the index

Only after Step 2 reports zero duplicate groups:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "notifications_order_request_unique"
    ON "notifications"("userId", "orderId")
    WHERE "type" = 'ORDER_REQUEST' AND "orderId" IS NOT NULL;
```

### Why a partial index instead of `@@unique([userId, type, orderId])`

- `orderId` is nullable and most notification types legitimately have a NULL
  `orderId`. Postgres treats NULLs as distinct so a plain unique would tolerate
  those rows, but it would also impose uniqueness on types that must not be
  unique — several `MESSAGE` notifications for one order is valid, and
  constraining that would be an unintended behaviour change.
- A partial index constrains exactly the identity that must be unique: one
  `ORDER_REQUEST` per `(recipient seller, order)`, and nothing else.

This DDL is intentionally **not** represented as a Prisma migration, because a
migration directory would be recorded as applied while doing nothing, and the
index would then never run.
