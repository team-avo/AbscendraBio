-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "bulkTotalPrice" DECIMAL(10,2),
ADD COLUMN     "bulkUnitPrice" DECIMAL(10,2);

-- CreateTable
CREATE TABLE "bulk_prices" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "minQty" INTEGER NOT NULL,
    "maxQty" INTEGER,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_prices_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bulk_prices" ADD CONSTRAINT "bulk_prices_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
