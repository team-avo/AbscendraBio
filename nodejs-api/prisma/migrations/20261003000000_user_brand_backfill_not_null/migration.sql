-- Backfill User.brand and make it non-null going forward.
-- Historical Ascendra-era accounts were created before the brand column existed, so their
-- brand was NULL. NULL silently meant "Ascendra" in code, but a missing brand is error-prone
-- (it drove a broken reset-link host for at least one account). This pins every existing row
-- to an explicit brand and guarantees all future rows carry one.
UPDATE "users" SET "brand" = 'ascendra' WHERE "brand" IS NULL;
ALTER TABLE "users" ALTER COLUMN "brand" SET DEFAULT 'ascendra';
ALTER TABLE "users" ALTER COLUMN "brand" SET NOT NULL;
