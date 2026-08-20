-- Track when a cart was last synced to GHL as "abandoned cart" so the
-- abandonedCartPoll cron fires once per abandonment (re-armed when the cart is
-- touched after this timestamp). Null = never synced.
ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "abandonedSyncedAt" TIMESTAMP(3);
