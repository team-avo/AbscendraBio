-- Affiliate attribution capture on Order: which affiliate + click a lineara.co/r/{slug} order came
-- from. Sourced from the sealed lineara_ref cookie server-side. The signed conversion report to the
-- partner portal (crediting the affiliate) is a separate later step. Idempotent.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "affiliateId" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "affiliateClickId" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "affiliateSlug" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "affiliateClickedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "orders_affiliateId_idx" ON "orders"("affiliateId");
