-- AlterTable: link a product variant to a lot-management peptide strength
ALTER TABLE "product_variants" ADD COLUMN "peptideStrengthId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_peptideStrengthId_key" ON "product_variants"("peptideStrengthId");

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_peptideStrengthId_fkey" FOREIGN KEY ("peptideStrengthId") REFERENCES "lm_peptide_strengths"("id") ON DELETE SET NULL ON UPDATE CASCADE;
