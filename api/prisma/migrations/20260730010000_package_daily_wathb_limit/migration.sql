-- AlterTable
ALTER TABLE "packages" ADD COLUMN "dailyWathbLimit" INTEGER;

-- Backfill: free packages keep the 1/day cap they effectively had (FRE-002);
-- paid packages stay NULL = unlimited, matching current behaviour.
UPDATE "packages" SET "dailyWathbLimit" = 1 WHERE "priceHalalas" = 0;
