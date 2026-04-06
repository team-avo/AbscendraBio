-- CreateEnum
CREATE TYPE "CustomerApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DEACTIVATED');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "approvalStatus" "CustomerApprovalStatus" NOT NULL DEFAULT 'PENDING';
