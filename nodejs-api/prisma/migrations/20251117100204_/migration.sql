-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SALES_MANAGER';

-- AlterTable
ALTER TABLE "sales_representatives" ADD COLUMN     "salesManagerId" TEXT;

-- CreateTable
CREATE TABLE "sales_managers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "sales_managers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_managers_userId_key" ON "sales_managers"("userId");

-- AddForeignKey
ALTER TABLE "sales_managers" ADD CONSTRAINT "sales_managers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_representatives" ADD CONSTRAINT "sales_representatives_salesManagerId_fkey" FOREIGN KEY ("salesManagerId") REFERENCES "sales_managers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
