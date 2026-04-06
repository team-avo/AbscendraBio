-- AlterTable
ALTER TABLE "campaigns" ADD COLUMN     "audienceFilter" JSONB,
ADD COLUMN     "emailTemplateType" "EmailTemplateType";
