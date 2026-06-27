-- CreateTable
CREATE TABLE "wholesale_prices" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Research Peptides',
    "reg" DOUBLE PRECISION NOT NULL,
    "m2" DOUBLE PRECISION NOT NULL,
    "m5" DOUBLE PRECISION NOT NULL,
    "m10" DOUBLE PRECISION NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wholesale_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wholesale_prices_name_strength_key" ON "wholesale_prices"("name", "strength");
