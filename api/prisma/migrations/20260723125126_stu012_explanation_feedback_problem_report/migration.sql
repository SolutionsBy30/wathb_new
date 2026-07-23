-- CreateEnum
CREATE TYPE "ExplanationRating" AS ENUM ('up', 'down');

-- CreateEnum
CREATE TYPE "ProblemReportStatus" AS ENUM ('open', 'resolved');

-- AlterTable
ALTER TABLE "answers" ADD COLUMN     "explanationRating" "ExplanationRating";

-- CreateTable
CREATE TABLE "problem_reports" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerId" TEXT,
    "note" TEXT,
    "status" "ProblemReportStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "problem_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "problem_reports_status_idx" ON "problem_reports"("status");

-- AddForeignKey
ALTER TABLE "problem_reports" ADD CONSTRAINT "problem_reports_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_reports" ADD CONSTRAINT "problem_reports_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "problem_reports" ADD CONSTRAINT "problem_reports_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "answers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
