-- AlterTable
ALTER TABLE "promotions" ADD COLUMN     "isForIndividualCustomer" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "promotion_customers" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promotion_customers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promotion_customers_promotionId_customerId_key" ON "promotion_customers"("promotionId", "customerId");

-- AddForeignKey
ALTER TABLE "promotion_customers" ADD CONSTRAINT "promotion_customers_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotion_customers" ADD CONSTRAINT "promotion_customers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
