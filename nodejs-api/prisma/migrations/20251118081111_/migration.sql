-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ZELLE', 'BANK_WIRE', 'AUTHORIZE_NET');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "selectedPaymentType" "PaymentType";
