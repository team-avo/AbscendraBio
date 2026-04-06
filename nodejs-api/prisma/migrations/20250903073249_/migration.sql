-- CreateTable
CREATE TABLE "variant_images" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "variant_images_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "variant_images" ADD CONSTRAINT "variant_images_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
