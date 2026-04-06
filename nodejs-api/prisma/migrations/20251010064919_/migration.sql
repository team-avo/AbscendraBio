-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "mobileVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "mobile_verification_codes" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "mobile" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mobile_verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mobile_verification_codes_customerId_idx" ON "mobile_verification_codes"("customerId");

-- CreateIndex
CREATE INDEX "mobile_verification_codes_mobile_idx" ON "mobile_verification_codes"("mobile");

-- AddForeignKey
ALTER TABLE "mobile_verification_codes" ADD CONSTRAINT "mobile_verification_codes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
