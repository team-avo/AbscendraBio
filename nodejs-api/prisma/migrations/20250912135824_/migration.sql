-- CreateTable
CREATE TABLE "site_seo" (
    "id" TEXT NOT NULL,
    "siteName" TEXT NOT NULL,
    "defaultTitle" TEXT NOT NULL,
    "defaultDescription" TEXT NOT NULL,
    "defaultKeywords" TEXT,
    "defaultOgImageUrl" TEXT,
    "allowIndexing" BOOLEAN NOT NULL DEFAULT true,
    "googleAnalyticsId" TEXT,
    "googleTagManagerId" TEXT,
    "facebookPixelId" TEXT,
    "additionalHeadTags" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_seo_pkey" PRIMARY KEY ("id")
);
