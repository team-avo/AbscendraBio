-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "smsConsentAt" TIMESTAMP(3),
ADD COLUMN     "smsConsentSource" TEXT,
ADD COLUMN     "smsMarketingConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smsTransactionalConsent" BOOLEAN NOT NULL DEFAULT false;
