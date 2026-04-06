-- CreateEnum
CREATE TYPE "PaymentGatewayName" AS ENUM ('DIRECT', 'STRIPE', 'PAYPAL', 'MANUAL', 'OTHER');

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "paymentGatewayTransactionId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL,
    "paymentGatewayName" "PaymentGatewayName" NOT NULL,
    "paymentGatewayResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
