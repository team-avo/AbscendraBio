/*
  Warnings:

  - The values [DIRECT,STRIPE,PAYPAL] on the enum `PaymentGatewayName` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
ALTER TYPE "EmailTemplateType" ADD VALUE 'PAYMENT_SUCCESS';

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentGatewayName_new" AS ENUM ('AUTHORIZE_NET', 'MANUAL', 'OTHER');
ALTER TABLE "Transaction" ALTER COLUMN "paymentGatewayName" TYPE "PaymentGatewayName_new" USING ("paymentGatewayName"::text::"PaymentGatewayName_new");
ALTER TYPE "PaymentGatewayName" RENAME TO "PaymentGatewayName_old";
ALTER TYPE "PaymentGatewayName_new" RENAME TO "PaymentGatewayName";
DROP TYPE "PaymentGatewayName_old";
COMMIT;
