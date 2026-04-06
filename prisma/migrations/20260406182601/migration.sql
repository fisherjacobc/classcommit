/*
  Warnings:

  - Added the required column `published` to the `Assignment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ref` to the `Submission` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "published" BOOLEAN NOT NULL;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "ref" TEXT NOT NULL;
