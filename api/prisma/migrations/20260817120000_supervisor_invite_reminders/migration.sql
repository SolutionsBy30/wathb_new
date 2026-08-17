-- SUP-009 — pending supervisor-invite reminder ladder.
ALTER TABLE "student_supervisors" ADD COLUMN "invitedAt" TIMESTAMP(3);
ALTER TABLE "student_supervisors" ADD COLUMN "lastRemindedAt" TIMESTAMP(3);
ALTER TABLE "student_supervisors" ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0;

-- Links that already exist predate the ladder. Leaving invitedAt NULL keeps
-- them out of the sweep entirely (it filters on invitedAt IS NOT NULL), so
-- deploying this does not fire a burst of reminders at every supervisor who
-- has ever been invited and never replied. They start receiving reminders
-- only if the student invites them again.

CREATE INDEX "student_supervisors_acceptedAt_revokedAt_idx" ON "student_supervisors"("acceptedAt", "revokedAt");
