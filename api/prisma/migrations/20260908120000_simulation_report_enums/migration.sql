-- §7.6 — the enum values the المحاكي result notification needs.
--
-- Alone in its own migration on purpose. ALTER TYPE ... ADD VALUE cannot be
-- used in the same transaction that adds it, and on PostgreSQL before 12 it
-- cannot run inside a transaction at all. Keeping these three statements away
-- from any table change means that if this file is the one that has to be
-- applied by hand, nothing else is stranded with it.
ALTER TYPE "MagicLinkPurpose" ADD VALUE IF NOT EXISTS 'simulation_report';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'simulation_result_student';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'simulation_result_supervisor';
