-- CreateTable
CREATE TABLE "custom_state_city" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "state" TEXT,
    "city" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_state_city_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_state_city_country_idx" ON "custom_state_city"("country");

-- CreateIndex
CREATE INDEX "custom_state_city_country_state_idx" ON "custom_state_city"("country", "state");

-- CreateIndex
CREATE UNIQUE INDEX "custom_state_city_country_state_city_key" ON "custom_state_city"("country", "state", "city");
