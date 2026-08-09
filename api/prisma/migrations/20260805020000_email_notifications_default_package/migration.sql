-- AlterTable
ALTER TABLE "packages" ADD COLUMN     "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "notificationEmail" TEXT;


-- FRE-009 — nominate a default package so signup auto-enrolment has a target
-- the moment this deploys. The cheapest active public package is the free one
-- in every environment we run; if none exists the UPDATE is a harmless no-op
-- and an admin picks one in the Packages screen instead.
UPDATE "packages" SET "isDefault" = true
WHERE id = (
  SELECT id FROM "packages"
  WHERE "isActive" = true AND "visibility" = 'public'
  ORDER BY "priceHalalas" ASC, "createdAt" ASC
  LIMIT 1
);

-- NOT-012 — email is a parallel copy of the same notification rather than a
-- separate one: [userId, kind, scheduledFor] is the idempotency key that stops
-- a duplicate daily message, so a second row would collide with it.
ALTER TABLE "notifications" ADD COLUMN "emailSentAt" TIMESTAMP(3);
