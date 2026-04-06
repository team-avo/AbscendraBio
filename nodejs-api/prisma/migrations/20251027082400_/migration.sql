/*
  Warnings:

  - You are about to drop the column `warehouseAddress` on the `store_information` table. All the data in the column will be lost.
  - You are about to drop the column `warehouseCity` on the `store_information` table. All the data in the column will be lost.
  - You are about to drop the column `warehouseCountry` on the `store_information` table. All the data in the column will be lost.
  - You are about to drop the column `warehouseName` on the `store_information` table. All the data in the column will be lost.
  - You are about to drop the column `warehousePostalCode` on the `store_information` table. All the data in the column will be lost.
  - You are about to drop the column `warehouseState` on the `store_information` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT DEFAULT 'US',
ADD COLUMN     "email" TEXT,
ADD COLUMN     "mobile" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "store_information" DROP COLUMN "warehouseAddress",
DROP COLUMN "warehouseCity",
DROP COLUMN "warehouseCountry",
DROP COLUMN "warehouseName",
DROP COLUMN "warehousePostalCode",
DROP COLUMN "warehouseState";
