-- CreateEnum
CREATE TYPE "SchoolStatus" AS ENUM ('approved', 'pending_review');

-- AlterTable
ALTER TABLE "students" ADD COLUMN     "schoolId" TEXT;

-- CreateTable
CREATE TABLE "regions" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schools" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "status" "SchoolStatus" NOT NULL DEFAULT 'approved',
    "suggestedByStudentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_stats" (
    "questionVersionId" TEXT NOT NULL,
    "nServed" INTEGER NOT NULL DEFAULT 0,
    "nCorrect" INTEGER NOT NULL DEFAULT 0,
    "pValue" DOUBLE PRECISION,
    "discrimination" DOUBLE PRECISION,
    "meanTimeMs" INTEGER NOT NULL DEFAULT 0,
    "timeoutRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "distractorDist" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "question_stats_pkey" PRIMARY KEY ("questionVersionId")
);

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_stats" ADD CONSTRAINT "question_stats_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "question_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
