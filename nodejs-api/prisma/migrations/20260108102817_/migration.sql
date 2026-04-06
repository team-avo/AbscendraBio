-- CreateTable
CREATE TABLE "sales_manager_customer_assignments" (
    "id" TEXT NOT NULL,
    "salesManagerId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_manager_customer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sales_manager_customer_assignments_salesManagerId_customerI_key" ON "sales_manager_customer_assignments"("salesManagerId", "customerId");

-- AddForeignKey
ALTER TABLE "sales_manager_customer_assignments" ADD CONSTRAINT "sales_manager_customer_assignments_salesManagerId_fkey" FOREIGN KEY ("salesManagerId") REFERENCES "sales_managers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_manager_customer_assignments" ADD CONSTRAINT "sales_manager_customer_assignments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
