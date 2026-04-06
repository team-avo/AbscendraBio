-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'SALES_REP';

-- CreateTable
CREATE TABLE "sales_representatives" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "sales_representatives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_rep_customer_assignments" (
    "id" TEXT NOT NULL,
    "salesRepId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_rep_customer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_representatives_userId_key" ON "sales_representatives"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_rep_customer_assignments_salesRepId_customerId_key" ON "sales_rep_customer_assignments"("salesRepId", "customerId");

-- AddForeignKey
ALTER TABLE "sales_representatives" ADD CONSTRAINT "sales_representatives_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_rep_customer_assignments" ADD CONSTRAINT "sales_rep_customer_assignments_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "sales_representatives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_rep_customer_assignments" ADD CONSTRAINT "sales_rep_customer_assignments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
