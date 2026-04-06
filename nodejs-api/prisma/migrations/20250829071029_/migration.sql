-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "idealFor" TEXT,
ADD COLUMN     "keyBenefits" TEXT,
ADD COLUMN     "taxName" TEXT,
ADD COLUMN     "taxPercentage" DECIMAL(5,2);
