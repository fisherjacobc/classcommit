-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "autogradeWithRubric" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
-- ALTER TABLE "Class" ALTER COLUMN "joinCode" SET DEFAULT nanoid_alphanumeric();

-- CreateTable
CREATE TABLE "Rubric" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assignmentId" INTEGER NOT NULL,

    CONSTRAINT "Rubric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RubricCriterion" (
    "id" SERIAL NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL,
    "expectedCodeOutput" TEXT,
    "rubricId" INTEGER NOT NULL,

    CONSTRAINT "RubricCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rubric_assignmentId_key" ON "Rubric"("assignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "RubricCriterion_rubricId_position_key" ON "RubricCriterion"("rubricId", "position");

-- AddForeignKey
ALTER TABLE "Rubric" ADD CONSTRAINT "Rubric_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RubricCriterion" ADD CONSTRAINT "RubricCriterion_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "Rubric"("id") ON DELETE CASCADE ON UPDATE CASCADE;
