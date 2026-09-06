-- NOT-022 — student-set temporary pause on the daily leap notification.
-- Null means not paused, which is every existing row, so this changes nothing
-- until a student actually uses it.
ALTER TABLE "students" ADD COLUMN "notificationsPausedUntil" TIMESTAMP(3);
