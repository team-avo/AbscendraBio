-- AlterEnum
ALTER TYPE "EmailTemplateType" ADD VALUE 'BULK_QUOTE';

-- CreateTable
CREATE TABLE "bulk_quotes" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "readBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulk_quotes_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "bulk_quotes" ADD CONSTRAINT "bulk_quotes_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_quotes" ADD CONSTRAINT "bulk_quotes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bulk_quotes" ADD CONSTRAINT "bulk_quotes_readBy_fkey" FOREIGN KEY ("readBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
