-- CreateEnum
CREATE TYPE "ThirdPartyReportCategory" AS ENUM ('PURITY', 'ENDOTOXICITY', 'STERILITY');

-- CreateEnum
CREATE TYPE "LoginAttemptStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "CommentType" AS ENUM ('ORDER', 'CUSTOMER');

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_billingAddressId_fkey";

-- DropForeignKey
ALTER TABLE "orders" DROP CONSTRAINT "orders_shippingAddressId_fkey";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "billingAddress1" TEXT,
ADD COLUMN     "billingAddress2" TEXT,
ADD COLUMN     "billingCity" TEXT,
ADD COLUMN     "billingCompany" TEXT,
ADD COLUMN     "billingCountry" TEXT,
ADD COLUMN     "billingFirstName" TEXT,
ADD COLUMN     "billingLastName" TEXT,
ADD COLUMN     "billingPhone" TEXT,
ADD COLUMN     "billingPostalCode" TEXT,
ADD COLUMN     "billingState" TEXT,
ADD COLUMN     "shippingAddress1" TEXT,
ADD COLUMN     "shippingAddress2" TEXT,
ADD COLUMN     "shippingCity" TEXT,
ADD COLUMN     "shippingCompany" TEXT,
ADD COLUMN     "shippingCountry" TEXT,
ADD COLUMN     "shippingFirstName" TEXT,
ADD COLUMN     "shippingLastName" TEXT,
ADD COLUMN     "shippingPhone" TEXT,
ADD COLUMN     "shippingPostalCode" TEXT,
ADD COLUMN     "shippingState" TEXT,
ALTER COLUMN "billingAddressId" DROP NOT NULL,
ALTER COLUMN "shippingAddressId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sales_channels" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "addressLine2" TEXT,
ADD COLUMN     "autoPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT DEFAULT 'US',
ADD COLUMN     "currentBalance" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "pendingBalance" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "webhookUrl" TEXT;

-- CreateTable
CREATE TABLE "shipping_status" (
    "id" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shipmentStatus" TEXT,
    "statusDetailCode" TEXT,
    "rawData" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_tiers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSubtotal" DECIMAL(10,2) NOT NULL,
    "maxSubtotal" DECIMAL(10,2),
    "shippingRate" DECIMAL(10,2) NOT NULL,
    "serviceName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_channel_shipping_tiers" (
    "id" TEXT NOT NULL,
    "salesChannelId" TEXT NOT NULL,
    "uniqueTierId" TEXT,
    "name" TEXT NOT NULL,
    "minSubtotal" DECIMAL(10,2) NOT NULL,
    "maxSubtotal" DECIMAL(10,2),
    "shippingRate" DECIMAL(10,2) NOT NULL,
    "serviceName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_channel_shipping_tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "third_party_reports" (
    "id" TEXT NOT NULL,
    "category" "ThirdPartyReportCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "third_party_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "userId" TEXT,
    "status" "LoginAttemptStatus" NOT NULL,
    "failureReason" TEXT,
    "failureDetail" TEXT,
    "portal" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "deviceInfo" JSONB,
    "source" TEXT NOT NULL DEFAULT 'server',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "type" "CommentType" NOT NULL,
    "content" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProductToThirdPartyReport" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_VariantToThirdPartyReport" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "shipping_status_labelId_key" ON "shipping_status"("labelId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_channel_shipping_tiers_salesChannelId_uniqueTierId_key" ON "sales_channel_shipping_tiers"("salesChannelId", "uniqueTierId");

-- CreateIndex
CREATE INDEX "login_attempts_email_idx" ON "login_attempts"("email");

-- CreateIndex
CREATE INDEX "login_attempts_status_idx" ON "login_attempts"("status");

-- CreateIndex
CREATE INDEX "login_attempts_createdAt_idx" ON "login_attempts"("createdAt");

-- CreateIndex
CREATE INDEX "login_attempts_userId_idx" ON "login_attempts"("userId");

-- CreateIndex
CREATE INDEX "comments_orderId_idx" ON "comments"("orderId");

-- CreateIndex
CREATE INDEX "comments_customerId_idx" ON "comments"("customerId");

-- CreateIndex
CREATE INDEX "comments_userId_idx" ON "comments"("userId");

-- CreateIndex
CREATE INDEX "comments_parentId_idx" ON "comments"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "_ProductToThirdPartyReport_AB_unique" ON "_ProductToThirdPartyReport"("A", "B");

-- CreateIndex
CREATE INDEX "_ProductToThirdPartyReport_B_index" ON "_ProductToThirdPartyReport"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_VariantToThirdPartyReport_AB_unique" ON "_VariantToThirdPartyReport"("A", "B");

-- CreateIndex
CREATE INDEX "_VariantToThirdPartyReport_B_index" ON "_VariantToThirdPartyReport"("B");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_billingAddressId_fkey" FOREIGN KEY ("billingAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_shippingAddressId_fkey" FOREIGN KEY ("shippingAddressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_status" ADD CONSTRAINT "shipping_status_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_channel_shipping_tiers" ADD CONSTRAINT "sales_channel_shipping_tiers_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "sales_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductToThirdPartyReport" ADD CONSTRAINT "_ProductToThirdPartyReport_A_fkey" FOREIGN KEY ("A") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProductToThirdPartyReport" ADD CONSTRAINT "_ProductToThirdPartyReport_B_fkey" FOREIGN KEY ("B") REFERENCES "third_party_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_VariantToThirdPartyReport" ADD CONSTRAINT "_VariantToThirdPartyReport_A_fkey" FOREIGN KEY ("A") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_VariantToThirdPartyReport" ADD CONSTRAINT "_VariantToThirdPartyReport_B_fkey" FOREIGN KEY ("B") REFERENCES "third_party_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
