-- AlterTable
ALTER TABLE "packages" ADD COLUMN     "sort" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "wathbs" ADD COLUMN     "testId" TEXT;

-- CreateTable
CREATE TABLE "student_tests" (
    "studentId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetScore" INTEGER,
    "testDate" TIMESTAMP(3),

    CONSTRAINT "student_tests_pkey" PRIMARY KEY ("studentId","testId")
);

-- AddForeignKey
ALTER TABLE "student_tests" ADD CONSTRAINT "student_tests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_tests" ADD CONSTRAINT "student_tests_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wathbs" ADD CONSTRAINT "wathbs_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: every existing student's current goal becomes their first
-- enabled StudentTest, and existing bundles get the test they were drawn
-- from, so leap history is complete rather than starting from today.
INSERT INTO "student_tests" ("studentId", "testId", "isActive", "targetScore", "testDate")
SELECT "userId", "targetTestId", true, "targetScore", "testDate"
FROM "students" WHERE "targetTestId" IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE "wathbs" w SET "testId" = s."targetTestId"
FROM "students" s WHERE s."userId" = w."studentId" AND w."testId" IS NULL;
