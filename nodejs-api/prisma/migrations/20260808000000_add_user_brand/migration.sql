-- Add User.brand: the storefront that created the user ("lineara"); NULL = Ascendra (default).
-- Drives brand-aware auth emails (verification / password reset send from the right domain + branding).
-- Idempotent so it is safe whether applied out-of-band first or via `prisma migrate deploy`.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "brand" TEXT;
