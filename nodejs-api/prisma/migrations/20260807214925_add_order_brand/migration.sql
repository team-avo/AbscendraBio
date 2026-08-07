-- Add storefront brand marker to orders (null/absent = Ascendra Bio; "lineara" = Lineará).
-- Presentational only — drives which Resend account/branding sends the order emails.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "brand" TEXT;
