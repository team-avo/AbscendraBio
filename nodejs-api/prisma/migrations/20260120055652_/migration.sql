-- CreateEnum
CREATE TYPE "OdooSyncTrigger" AS ENUM ('MANUAL_FULL', 'MANUAL_SINGLE', 'ORDER_CREATED', 'ORDER_SHIPPED', 'TEST', 'INVENTORY_ADJUSTMENT', 'ORDER_CANCELLED', 'INVENTORY_ADJUSTMENT_MANUAL', 'INVENTORY_ADJUSTMENT_API', 'PRICE_UPDATE', 'PRODUCT_CREATED', 'PRODUCT_UPDATED', 'SCHEDULED_SYNC', 'TEST_CONNECTION');

-- CreateEnum
CREATE TYPE "OdooSyncStatus" AS ENUM ('SUCCESS', 'FAILED', 'PENDING');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('RECEIVABLE', 'PAYMENT', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerEntryStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "StatementStatus" AS ENUM ('SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "EmailTemplateType" ADD VALUE 'PARTNER_STATEMENT_GENERATED';
ALTER TYPE "EmailTemplateType" ADD VALUE 'PARTNER_PAYMENT_REMINDER';
ALTER TYPE "EmailTemplateType" ADD VALUE 'PARTNER_OVERDUE_ALERT';

-- CreateTable
CREATE TABLE "odoo_sync_logs" (
    "id" TEXT NOT NULL,
    "triggerType" "OdooSyncTrigger" NOT NULL,
    "triggerReason" TEXT,
    "variantId" TEXT,
    "variantSku" TEXT,
    "productId" TEXT,
    "productName" TEXT,
    "orderId" TEXT,
    "httpMethod" TEXT,
    "endpoint" TEXT,
    "statusCode" INTEGER,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "status" "OdooSyncStatus" NOT NULL,
    "errorMessage" TEXT,
    "duration" INTEGER,
    "initiatedBy" TEXT,
    "salesChannelId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odoo_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odoo_integration_config" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Skydell Odoo Integration',
    "salesChannelId" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "apiBaseUrl" TEXT NOT NULL DEFAULT 'https://bol9967-odoo18-tk.odoo.com',
    "apiToken" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL DEFAULT '7',
    "lastSyncAt" TIMESTAMP(3),
    "lastSyncStatus" TEXT,
    "syncedProducts" INTEGER NOT NULL DEFAULT 0,
    "syncedVariants" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "odoo_integration_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_statement_configs" (
    "id" TEXT NOT NULL,
    "salesChannelId" TEXT NOT NULL,
    "billingCycleDays" INTEGER NOT NULL DEFAULT 14,
    "balanceThreshold" DECIMAL(10,2),
    "orderCountThreshold" INTEGER,
    "statementTotalThreshold" DECIMAL(10,2),
    "paymentInstructions" TEXT,
    "escalationDays" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_statement_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_ledger_entries" (
    "id" TEXT NOT NULL,
    "salesChannelId" TEXT NOT NULL,
    "orderId" TEXT,
    "statementId" TEXT,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "remainingAmount" DECIMAL(10,2) NOT NULL,
    "status" "LedgerEntryStatus" NOT NULL DEFAULT 'UNPAID',
    "description" TEXT,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_statements" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "salesChannelId" TEXT NOT NULL,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "StatementStatus" NOT NULL DEFAULT 'SENT',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_statements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "odoo_sync_logs_variantId_idx" ON "odoo_sync_logs"("variantId");

-- CreateIndex
CREATE INDEX "odoo_sync_logs_productId_idx" ON "odoo_sync_logs"("productId");

-- CreateIndex
CREATE INDEX "odoo_sync_logs_orderId_idx" ON "odoo_sync_logs"("orderId");

-- CreateIndex
CREATE INDEX "odoo_sync_logs_salesChannelId_idx" ON "odoo_sync_logs"("salesChannelId");

-- CreateIndex
CREATE INDEX "odoo_sync_logs_status_idx" ON "odoo_sync_logs"("status");

-- CreateIndex
CREATE INDEX "odoo_sync_logs_triggerType_idx" ON "odoo_sync_logs"("triggerType");

-- CreateIndex
CREATE INDEX "odoo_sync_logs_createdAt_idx" ON "odoo_sync_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "odoo_integration_config_salesChannelId_key" ON "odoo_integration_config"("salesChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_statement_configs_salesChannelId_key" ON "partner_statement_configs"("salesChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_statements_referenceId_key" ON "partner_statements"("referenceId");

-- AddForeignKey
ALTER TABLE "odoo_sync_logs" ADD CONSTRAINT "odoo_sync_logs_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odoo_sync_logs" ADD CONSTRAINT "odoo_sync_logs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odoo_sync_logs" ADD CONSTRAINT "odoo_sync_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odoo_sync_logs" ADD CONSTRAINT "odoo_sync_logs_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "sales_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odoo_integration_config" ADD CONSTRAINT "odoo_integration_config_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "sales_channels"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_statement_configs" ADD CONSTRAINT "partner_statement_configs_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "sales_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_ledger_entries" ADD CONSTRAINT "partner_ledger_entries_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "sales_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_ledger_entries" ADD CONSTRAINT "partner_ledger_entries_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_ledger_entries" ADD CONSTRAINT "partner_ledger_entries_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "partner_statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_statements" ADD CONSTRAINT "partner_statements_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "sales_channels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
