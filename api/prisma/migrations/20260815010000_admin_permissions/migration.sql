-- ADM-088 — per-admin console permissions.
ALTER TABLE "users" ADD COLUMN "adminPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "users" ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Existing admins had unrestricted access before this migration, and locking
-- them all out on deploy would be a worse failure than over-granting: the
-- first thing an operator does after this ships is log in and tighten it.
-- Every current admin therefore becomes a super-admin, and narrower accounts
-- are created from there.
UPDATE "users" SET "isSuperAdmin" = true WHERE "role" = 'admin';
