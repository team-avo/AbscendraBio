-- AlterTable
ALTER TABLE "inventory" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "sellWhenOutOfStock" BOOLEAN NOT NULL DEFAULT false;
