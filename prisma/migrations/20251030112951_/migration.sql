/*
  Warnings:

  - You are about to drop the `Post` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `name` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "public"."Post" DROP CONSTRAINT "Post_createdById_fkey";

-- AlterTable
ALTER TABLE "public"."User" ALTER COLUMN "name" SET NOT NULL;

-- DropTable
DROP TABLE "public"."Post";

-- CreateTable
CREATE TABLE "public"."Class" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "term" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Class_name_idx" ON "public"."Class"("name");

-- AddForeignKey
ALTER TABLE "public"."Class" ADD CONSTRAINT "Class_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
