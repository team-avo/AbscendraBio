-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('HTML_CONTENT', 'TEXT_CONTENT');

-- AlterTable
ALTER TABLE "email_templates" ADD COLUMN     "contentType" "ContentType" NOT NULL DEFAULT 'HTML_CONTENT';
