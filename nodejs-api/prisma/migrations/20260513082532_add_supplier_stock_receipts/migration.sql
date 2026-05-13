-- CreateEnum
CREATE TYPE "PendingReceiptStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "LineMatchStatus" AS ENUM ('UNMATCHED', 'AUTO_MATCHED', 'MANUAL_MATCHED', 'REJECTED');

-- CreateTable
CREATE TABLE "supplier_email_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "parserKey" TEXT NOT NULL,
    "defaultLocationId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_email_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_product_mappings" (
    "id" TEXT NOT NULL,
    "supplierSourceId" TEXT NOT NULL,
    "supplierProductName" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantityMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_product_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_stock_receipts" (
    "id" TEXT NOT NULL,
    "supplierSourceId" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "gmailThreadId" TEXT,
    "orderNumber" TEXT,
    "rawSubject" TEXT NOT NULL,
    "rawHtml" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "status" "PendingReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "processedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_stock_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_stock_receipt_lines" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "supplierProductName" TEXT NOT NULL,
    "parsedQuantity" INTEGER NOT NULL,
    "matchedVariantId" TEXT,
    "effectiveQuantity" INTEGER,
    "matchStatus" "LineMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "appliedMovementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_stock_receipt_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_email_sources_senderEmail_key" ON "supplier_email_sources"("senderEmail");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_product_mappings_supplierSourceId_supplierProductN_key" ON "supplier_product_mappings"("supplierSourceId", "supplierProductName");

-- CreateIndex
CREATE UNIQUE INDEX "pending_stock_receipts_gmailMessageId_key" ON "pending_stock_receipts"("gmailMessageId");

-- CreateIndex
CREATE INDEX "pending_stock_receipts_status_idx" ON "pending_stock_receipts"("status");

-- CreateIndex
CREATE INDEX "pending_stock_receipts_supplierSourceId_idx" ON "pending_stock_receipts"("supplierSourceId");

-- CreateIndex
CREATE INDEX "pending_stock_receipt_lines_receiptId_idx" ON "pending_stock_receipt_lines"("receiptId");

-- AddForeignKey
ALTER TABLE "supplier_email_sources" ADD CONSTRAINT "supplier_email_sources_defaultLocationId_fkey" FOREIGN KEY ("defaultLocationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_product_mappings" ADD CONSTRAINT "supplier_product_mappings_supplierSourceId_fkey" FOREIGN KEY ("supplierSourceId") REFERENCES "supplier_email_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_product_mappings" ADD CONSTRAINT "supplier_product_mappings_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_stock_receipts" ADD CONSTRAINT "pending_stock_receipts_supplierSourceId_fkey" FOREIGN KEY ("supplierSourceId") REFERENCES "supplier_email_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_stock_receipts" ADD CONSTRAINT "pending_stock_receipts_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_stock_receipt_lines" ADD CONSTRAINT "pending_stock_receipt_lines_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "pending_stock_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_stock_receipt_lines" ADD CONSTRAINT "pending_stock_receipt_lines_matchedVariantId_fkey" FOREIGN KEY ("matchedVariantId") REFERENCES "product_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
