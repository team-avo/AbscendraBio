/*
  Warnings:

  - The values [ENTERPRISE] on the enum `CustomerType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CustomerType_new" AS ENUM ('B2C', 'B2B', 'ENTERPRISE_1', 'ENTERPRISE_2');
ALTER TABLE "customers" ALTER COLUMN "customerType" DROP DEFAULT;
ALTER TABLE "customers" ALTER COLUMN "customerType" TYPE "CustomerType_new" USING ("customerType"::text::"CustomerType_new");
ALTER TABLE "segment_prices" ALTER COLUMN "customerType" TYPE "CustomerType_new" USING ("customerType"::text::"CustomerType_new");
ALTER TABLE "promotions" ALTER COLUMN "customerTypes" TYPE "CustomerType_new"[] USING ("customerTypes"::text::"CustomerType_new"[]);
ALTER TYPE "CustomerType" RENAME TO "CustomerType_old";
ALTER TYPE "CustomerType_new" RENAME TO "CustomerType";
DROP TYPE "CustomerType_old";
ALTER TABLE "customers" ALTER COLUMN "customerType" SET DEFAULT 'B2C';
COMMIT;
