-- CreateTable
CREATE TABLE "footer_contact" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Contact',
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "footer_contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "footer_contact_settingsId_key" ON "footer_contact"("settingsId");

-- AddForeignKey
ALTER TABLE "footer_contact" ADD CONSTRAINT "footer_contact_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "footer_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
