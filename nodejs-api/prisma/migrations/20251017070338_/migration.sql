-- AlterTable
ALTER TABLE "products" ADD COLUMN     "isPopular" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "popular_product_order" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "popular_product_order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "popular_product_order_productId_key" ON "popular_product_order"("productId");

-- AddForeignKey
ALTER TABLE "popular_product_order" ADD CONSTRAINT "popular_product_order_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
