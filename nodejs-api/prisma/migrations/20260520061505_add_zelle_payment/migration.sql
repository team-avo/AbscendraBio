-- CreateEnum
CREATE TYPE "ZellePaymentStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'CONFIRMED', 'MANUALLY_MATCHED', 'IGNORED');

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'ZELLE';

-- CreateTable
CREATE TABLE "zelle_payments" (
    "id" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "gmailThreadId" TEXT,
    "rawSubject" TEXT NOT NULL,
    "rawHtml" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "parsedAmount" DECIMAL(10,2) NOT NULL,
    "parsedSenderName" TEXT NOT NULL,
    "parsedMemo" TEXT,
    "status" "ZellePaymentStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchConfidence" TEXT,
    "orderId" TEXT,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zelle_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "zelle_payments_gmailMessageId_key" ON "zelle_payments"("gmailMessageId");

-- CreateIndex
CREATE INDEX "zelle_payments_status_idx" ON "zelle_payments"("status");

-- CreateIndex
CREATE INDEX "zelle_payments_orderId_idx" ON "zelle_payments"("orderId");

-- CreateIndex
CREATE INDEX "zelle_payments_receivedAt_idx" ON "zelle_payments"("receivedAt");

-- AddForeignKey
ALTER TABLE "zelle_payments" ADD CONSTRAINT "zelle_payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
