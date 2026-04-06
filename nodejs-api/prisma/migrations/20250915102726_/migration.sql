-- CreateTable
CREATE TABLE "footer_settings" (
    "id" TEXT NOT NULL,
    "siteTitle" TEXT NOT NULL,
    "siteDescription" TEXT NOT NULL,
    "facebookUrl" TEXT,
    "twitterUrl" TEXT,
    "instagramUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "footer_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "footer_sections" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "footer_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "footer_links" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "target" TEXT DEFAULT '_self',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "footer_links_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "footer_sections" ADD CONSTRAINT "footer_sections_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "footer_settings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "footer_links" ADD CONSTRAINT "footer_links_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "footer_sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;
