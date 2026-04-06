-- CreateEnum
CREATE TYPE "EmailTemplateType" AS ENUM ('ORDER_CONFIRMATION', 'SHIPPING_NOTIFICATION', 'WELCOME_EMAIL', 'LOW_INVENTORY_ALERT', 'ORDER_CANCELLED', 'PAYMENT_FAILED', 'PASSWORD_RESET', 'ACCOUNT_VERIFICATION');

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "EmailTemplateType" NOT NULL,
    "subject" TEXT NOT NULL,
    "htmlContent" TEXT NOT NULL,
    "textContent" TEXT,
    "backgroundImage" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_type_key" ON "email_templates"("type");
