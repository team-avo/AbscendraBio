-- CreateTable
CREATE TABLE "store_information" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'US',
    "logoUrl" TEXT,
    "warehouseName" TEXT,
    "warehouseAddress" TEXT,
    "warehouseCity" TEXT,
    "warehouseState" TEXT,
    "warehousePostalCode" TEXT,
    "warehouseCountry" TEXT,
    "taxId" TEXT,
    "registrationNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "store_information_pkey" PRIMARY KEY ("id")
);
