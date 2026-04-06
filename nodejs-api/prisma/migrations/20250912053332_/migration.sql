-- CreateEnum
CREATE TYPE "PageType" AS ENUM ('STATIC_PAGE', 'BLOG_POST', 'LEGAL_PAGE', 'LANDING_PAGE', 'PRODUCT_PAGE', 'CUSTOM_PAGE');

-- CreateEnum
CREATE TYPE "PageStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED', 'SCHEDULED');

-- CreateEnum
CREATE TYPE "ContentFormat" AS ENUM ('HTML', 'MARKDOWN', 'RICH_TEXT');

-- CreateTable
CREATE TABLE "page_content" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" TEXT,
    "content" TEXT NOT NULL,
    "contentFormat" "ContentFormat" NOT NULL DEFAULT 'RICH_TEXT',
    "metaTitle" TEXT,
    "metaDescription" TEXT,
    "metaKeywords" TEXT,
    "ogImage" TEXT,
    "pageType" "PageType" NOT NULL DEFAULT 'STATIC_PAGE',
    "status" "PageStatus" NOT NULL DEFAULT 'DRAFT',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "allowComments" BOOLEAN NOT NULL DEFAULT false,
    "authorId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_content_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_versions" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentFormat" "ContentFormat" NOT NULL DEFAULT 'RICH_TEXT',
    "version" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,

    CONSTRAINT "content_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_views" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referrer" TEXT,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "page_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "page_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "navigation_menus" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "navigation_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "navigation_items" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "pageId" TEXT,
    "target" TEXT NOT NULL DEFAULT '_self',
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "navigation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_files" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "caption" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PageContentToPageTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "page_content_slug_key" ON "page_content"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "content_versions_pageId_version_key" ON "content_versions"("pageId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "page_tags_name_key" ON "page_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "page_tags_slug_key" ON "page_tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "navigation_menus_name_key" ON "navigation_menus"("name");

-- CreateIndex
CREATE UNIQUE INDEX "navigation_menus_location_key" ON "navigation_menus"("location");

-- CreateIndex
CREATE UNIQUE INDEX "_PageContentToPageTag_AB_unique" ON "_PageContentToPageTag"("A", "B");

-- CreateIndex
CREATE INDEX "_PageContentToPageTag_B_index" ON "_PageContentToPageTag"("B");

-- AddForeignKey
ALTER TABLE "page_content" ADD CONSTRAINT "page_content_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "page_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_versions" ADD CONSTRAINT "content_versions_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "page_views" ADD CONSTRAINT "page_views_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "page_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "navigation_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "page_content"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "navigation_items" ADD CONSTRAINT "navigation_items_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "navigation_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PageContentToPageTag" ADD CONSTRAINT "_PageContentToPageTag_A_fkey" FOREIGN KEY ("A") REFERENCES "page_content"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PageContentToPageTag" ADD CONSTRAINT "_PageContentToPageTag_B_fkey" FOREIGN KEY ("B") REFERENCES "page_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
