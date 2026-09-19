-- STU-036 — a learner sat the real exam; that preparation is finished.
--
-- Nullable and left null for every existing row: nobody has been asked yet,
-- and assuming a past exam date means "sat it" would silently remove live
-- students from their school's dashboard.
ALTER TABLE "student_tests" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "student_tests" ADD COLUMN "actualScore" INTEGER;

-- Every aggregate now filters on this, per student.
CREATE INDEX "student_tests_studentId_archivedAt_idx" ON "student_tests"("studentId", "archivedAt");
