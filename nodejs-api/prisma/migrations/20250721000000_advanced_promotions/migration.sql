-- CreateEnum for BOGO types
CREATE TYPE "BogoType" AS ENUM ('BUY_X_GET_Y_FREE', 'BUY_X_GET_Y_PERCENT', 'BUY_X_GET_Y_FIXED', 'CHEAPEST_FREE', 'MOST_EXPENSIVE_FREE');

-- CreateEnum for rule types
CREATE TYPE "RuleType" AS ENUM ('BUY', 'GET', 'INCLUDE', 'EXCLUDE');

-- CreateEnum for tier discount types
CREATE TYPE "TierDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FIXED_PRICE');

-- AlterTable promotions - Add new fields for advanced promotions
ALTER TABLE "promotions" ADD COLUMN "customerTypes" "CustomerType"[];
ALTER TABLE "promotions" ADD COLUMN "bogoType" "BogoType";
ALTER TABLE "promotions" ADD COLUMN "buyQuantity" INTEGER;
ALTER TABLE "promotions" ADD COLUMN "getQuantity" INTEGER;
ALTER TABLE "promotions" ADD COLUMN "getDiscount" DECIMAL(5,2);

-- CreateTable for promotion product rules
CREATE TABLE "promotion_product_rules" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "productId" TEXT,
    "variantId" TEXT,
    "ruleType" "RuleType" NOT NULL,
    "quantity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_product_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable for promotion category rules
CREATE TABLE "promotion_category_rules" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "ruleType" "RuleType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_category_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable for promotion volume tiers
CREATE TABLE "promotion_volume_tiers" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "minQuantity" INTEGER NOT NULL,
    "maxQuantity" INTEGER,
    "discountType" "TierDiscountType" NOT NULL,
    "discountValue" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_volume_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable for promotion usage tracking
CREATE TABLE "promotion_usage" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_usage_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "promotion_product_rules" ADD CONSTRAINT "promotion_product_rules_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_product_rules" ADD CONSTRAINT "promotion_product_rules_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_product_rules" ADD CONSTRAINT "promotion_product_rules_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_category_rules" ADD CONSTRAINT "promotion_category_rules_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_category_rules" ADD CONSTRAINT "promotion_category_rules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_volume_tiers" ADD CONSTRAINT "promotion_volume_tiers_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_usage" ADD CONSTRAINT "promotion_usage_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_usage" ADD CONSTRAINT "promotion_usage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_usage" ADD CONSTRAINT "promotion_usage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
