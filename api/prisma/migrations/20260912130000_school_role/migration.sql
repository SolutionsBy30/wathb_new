-- SCH-002 — the school-administrator role.
--
-- Alone in its own file, for the same reason as the simulation report enums:
-- ALTER TYPE ... ADD VALUE cannot be used in the transaction that adds it, and
-- on PostgreSQL before 12 cannot run inside one at all. Keeping it separate
-- means that if this has to be applied by hand, nothing else is stranded.
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'school';
ALTER TYPE "SubjectType" ADD VALUE IF NOT EXISTS 'school';
