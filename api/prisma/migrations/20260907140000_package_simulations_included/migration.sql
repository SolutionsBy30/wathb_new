-- §5.5 — simulation entitlement per package.
--
-- Additive with a default of 0: existing packages keep working and simply do
-- not include المحاكي until an admin says otherwise. Defaulting to a non-zero
-- value would silently grant full-length forms to every current subscriber and
-- drain the question bank before anyone chose to launch the feature.
ALTER TABLE "packages" ADD COLUMN "simulationsIncluded" INTEGER NOT NULL DEFAULT 0;
