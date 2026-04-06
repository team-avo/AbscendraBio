-- AlterTable
ALTER TABLE "shipping_rates" ADD COLUMN     "estimatedDays" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "carriers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "services" TEXT[],
    "trackingUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "carriers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "carriers_name_key" ON "carriers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "carriers_code_key" ON "carriers"("code");
