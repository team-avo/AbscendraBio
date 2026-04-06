-- CreateEnum
CREATE TYPE "SalesChannelType" AS ENUM ('OWN', 'PARTNER');

-- CreateEnum
CREATE TYPE "FulfillmentModel" AS ENUM ('OWN_ECOMMERCE', 'DROPSHIP');

-- CreateEnum
CREATE TYPE "SalesChannelStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "partnerOrderId" TEXT,
ADD COLUMN     "salesChannelId" TEXT;

-- CreateTable
CREATE TABLE "sales_channels" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactPerson" TEXT NOT NULL,
    "contactNumber" TEXT NOT NULL,
    "type" "SalesChannelType" NOT NULL DEFAULT 'PARTNER',
    "fulfillmentModel" "FulfillmentModel" NOT NULL DEFAULT 'DROPSHIP',
    "paymentTerms" TEXT,
    "status" "SalesChannelStatus" NOT NULL DEFAULT 'ACTIVE',
    "apiKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_channels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_channel_prices" (
    "id" TEXT NOT NULL,
    "salesChannelId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_channel_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_channels_apiKey_key" ON "sales_channels"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "sales_channel_prices_salesChannelId_variantId_key" ON "sales_channel_prices"("salesChannelId", "variantId");

-- CreateIndex
CREATE INDEX "orders_salesChannelId_partnerOrderId_idx" ON "orders"("salesChannelId", "partnerOrderId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "sales_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_channel_prices" ADD CONSTRAINT "sales_channel_prices_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "sales_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_channel_prices" ADD CONSTRAINT "sales_channel_prices_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
