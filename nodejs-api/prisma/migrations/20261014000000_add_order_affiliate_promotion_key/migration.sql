-- Trace the affiliate OFFER's promotion key on the order it discounted, so the signed paid-conversion
-- and reversal reports to the partner portal can carry promotionKey. Additive + nullable; null = no
-- affiliate offer applied. (Completes the affiliate offer/discount feature.)
ALTER TABLE "orders" ADD COLUMN "affiliatePromotionKey" TEXT;
