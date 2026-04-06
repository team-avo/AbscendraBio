/*
  Warnings:

  - You are about to drop the column `backgroundImage` on the `email_templates` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "email_templates" DROP COLUMN "backgroundImage",
ADD COLUMN     "backgroundImages" TEXT[] DEFAULT ARRAY[]::TEXT[];
