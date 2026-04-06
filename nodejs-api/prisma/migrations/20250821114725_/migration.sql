/*
  Warnings:

  - A unique constraint covering the columns `[customerId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'CUSTOMER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "customerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_customerId_key" ON "users"("customerId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
