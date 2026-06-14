-- CreateEnum
CREATE TYPE "PeptideCategory" AS ENUM ('RESEARCH', 'RESEARCH_BLEND', 'GLP1');

-- CreateEnum
CREATE TYPE "ServiceCategory" AS ENUM ('CORE', 'SAFETY', 'COMPOSITION', 'PHYSICAL');

-- CreateEnum
CREATE TYPE "LotStatus" AS ENUM ('IN_TESTING', 'RELEASED', 'QUARANTINE', 'REJECTED', 'EXPIRED', 'RECALLED');

-- CreateEnum
CREATE TYPE "CoaStatus" AS ENUM ('AWAITING_RESULTS', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CoaResult" AS ENUM ('PASS', 'FAIL', 'PENDING');

-- CreateTable
CREATE TABLE "lm_companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lm_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_peptides" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" "PeptideCategory" NOT NULL DEFAULT 'RESEARCH',
    "sequence" TEXT,
    "chemicalFormula" TEXT,
    "casNumber" TEXT,
    "molecularMass" TEXT,
    "shelfLifeMonths" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lm_peptides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_peptide_strengths" (
    "id" TEXT NOT NULL,
    "peptideId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "lm_peptide_strengths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "contactEmail" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lm_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_labs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "methodsOffered" TEXT,
    "contactEmail" TEXT,
    "phone" TEXT,
    "turnaround" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lm_labs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_testing_services" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ServiceCategory" NOT NULL DEFAULT 'CORE',
    "description" TEXT,
    "typicalLabs" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lm_testing_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_lots" (
    "id" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "procurementOrderId" TEXT NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL,
    "supplierId" TEXT NOT NULL,
    "peptideId" TEXT NOT NULL,
    "peptideStrengthId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "mfgDate" TIMESTAMP(3) NOT NULL,
    "seq" INTEGER NOT NULL,
    "expirationDate" TIMESTAMP(3) NOT NULL,
    "bud" TEXT NOT NULL,
    "receivedDate" TIMESTAMP(3),
    "storage" TEXT NOT NULL DEFAULT 'Store at -20°C, lyophilized',
    "status" "LotStatus" NOT NULL DEFAULT 'IN_TESTING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lm_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_coas" (
    "id" TEXT NOT NULL,
    "coaNumber" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "ownerCompanyId" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "labId" TEXT NOT NULL,
    "dateSubmitted" TIMESTAMP(3) NOT NULL,
    "testDate" TIMESTAMP(3),
    "dateReceived" TIMESTAMP(3),
    "hplcPurity" DOUBLE PRECISION,
    "msConfirmed" BOOLEAN,
    "overallResult" "CoaResult" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewDate" TIMESTAMP(3),
    "status" "CoaStatus" NOT NULL DEFAULT 'AWAITING_RESULTS',
    "fileUrl" TEXT,
    "fileKey" TEXT,
    "qrCodeUrl" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lm_coas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_coa_shares" (
    "id" TEXT NOT NULL,
    "coaId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lm_coa_shares_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_label_templates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "peptideId" TEXT,
    "name" TEXT NOT NULL,
    "artworkUrl" TEXT NOT NULL,
    "artworkKey" TEXT,
    "zones" JSONB NOT NULL,
    "widthMm" DOUBLE PRECISION,
    "heightMm" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lm_label_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lm_pattern_configs" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lm_pattern_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CoaTests" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "lm_companies_code_key" ON "lm_companies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lm_peptides_code_key" ON "lm_peptides"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lm_peptide_strengths_peptideId_code_key" ON "lm_peptide_strengths"("peptideId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "lm_suppliers_code_key" ON "lm_suppliers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lm_labs_code_key" ON "lm_labs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lm_testing_services_code_key" ON "lm_testing_services"("code");

-- CreateIndex
CREATE UNIQUE INDEX "lm_lots_lotNumber_key" ON "lm_lots"("lotNumber");

-- CreateIndex
CREATE INDEX "lm_lots_companyId_idx" ON "lm_lots"("companyId");

-- CreateIndex
CREATE INDEX "lm_lots_status_idx" ON "lm_lots"("status");

-- CreateIndex
CREATE INDEX "lm_lots_peptideId_idx" ON "lm_lots"("peptideId");

-- CreateIndex
CREATE UNIQUE INDEX "lm_coas_coaNumber_key" ON "lm_coas"("coaNumber");

-- CreateIndex
CREATE INDEX "lm_coas_ownerCompanyId_idx" ON "lm_coas"("ownerCompanyId");

-- CreateIndex
CREATE INDEX "lm_coas_lotId_idx" ON "lm_coas"("lotId");

-- CreateIndex
CREATE INDEX "lm_coas_status_idx" ON "lm_coas"("status");

-- CreateIndex
CREATE UNIQUE INDEX "lm_coa_shares_coaId_companyId_key" ON "lm_coa_shares"("coaId", "companyId");

-- CreateIndex
CREATE INDEX "lm_label_templates_companyId_idx" ON "lm_label_templates"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "lm_pattern_configs_key_key" ON "lm_pattern_configs"("key");

-- CreateIndex
CREATE UNIQUE INDEX "_CoaTests_AB_unique" ON "_CoaTests"("A", "B");

-- CreateIndex
CREATE INDEX "_CoaTests_B_index" ON "_CoaTests"("B");

-- AddForeignKey
ALTER TABLE "lm_peptide_strengths" ADD CONSTRAINT "lm_peptide_strengths_peptideId_fkey" FOREIGN KEY ("peptideId") REFERENCES "lm_peptides"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_lots" ADD CONSTRAINT "lm_lots_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "lm_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_lots" ADD CONSTRAINT "lm_lots_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "lm_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_lots" ADD CONSTRAINT "lm_lots_peptideId_fkey" FOREIGN KEY ("peptideId") REFERENCES "lm_peptides"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_lots" ADD CONSTRAINT "lm_lots_peptideStrengthId_fkey" FOREIGN KEY ("peptideStrengthId") REFERENCES "lm_peptide_strengths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_coas" ADD CONSTRAINT "lm_coas_ownerCompanyId_fkey" FOREIGN KEY ("ownerCompanyId") REFERENCES "lm_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_coas" ADD CONSTRAINT "lm_coas_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "lm_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_coas" ADD CONSTRAINT "lm_coas_labId_fkey" FOREIGN KEY ("labId") REFERENCES "lm_labs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_coa_shares" ADD CONSTRAINT "lm_coa_shares_coaId_fkey" FOREIGN KEY ("coaId") REFERENCES "lm_coas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_coa_shares" ADD CONSTRAINT "lm_coa_shares_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "lm_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lm_label_templates" ADD CONSTRAINT "lm_label_templates_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "lm_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CoaTests" ADD CONSTRAINT "_CoaTests_A_fkey" FOREIGN KEY ("A") REFERENCES "lm_coas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CoaTests" ADD CONSTRAINT "_CoaTests_B_fkey" FOREIGN KEY ("B") REFERENCES "lm_testing_services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
