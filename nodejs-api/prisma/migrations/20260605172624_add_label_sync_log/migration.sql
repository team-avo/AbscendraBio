-- CreateEnum
CREATE TYPE "LabelSyncStatus" AS ENUM ('SUCCESS', 'FAILED', 'NO_CHANGE', 'SKIPPED');

-- CreateTable
CREATE TABLE "label_sync_logs" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "orderNumber" TEXT NOT NULL,
    "statusBefore" TEXT NOT NULL,
    "statusAfter" TEXT,
    "syncStatus" "LabelSyncStatus" NOT NULL,
    "failureReason" TEXT,
    "shipstationLabelId" TEXT,
    "shipstationStatus" TEXT,
    "apiResponseJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "label_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "label_sync_logs_orderId_idx" ON "label_sync_logs"("orderId");

-- CreateIndex
CREATE INDEX "label_sync_logs_orderNumber_idx" ON "label_sync_logs"("orderNumber");

-- CreateIndex
CREATE INDEX "label_sync_logs_syncStatus_idx" ON "label_sync_logs"("syncStatus");

-- CreateIndex
CREATE INDEX "label_sync_logs_createdAt_idx" ON "label_sync_logs"("createdAt");

-- CreateIndex
CREATE INDEX "label_sync_logs_shipstationLabelId_idx" ON "label_sync_logs"("shipstationLabelId");

-- AddForeignKey
ALTER TABLE "label_sync_logs" ADD CONSTRAINT "label_sync_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
