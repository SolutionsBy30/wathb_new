-- PAY-010 — "was" price for a strikethrough. Presentation only; priceHalalas
-- remains the amount actually charged.
ALTER TABLE "packages" ADD COLUMN "compareAtHalalas" INTEGER;

-- PAY-011 — promo codes.
CREATE TYPE "DiscountKind" AS ENUM ('percent', 'fixed');

CREATE TABLE "discount_codes" (
  "id"             TEXT NOT NULL,
  "code"           TEXT NOT NULL,
  "kind"           "DiscountKind" NOT NULL,
  "value"          INTEGER NOT NULL,
  "packageIds"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "maxRedemptions" INTEGER,
  "timesRedeemed"  INTEGER NOT NULL DEFAULT 0,
  "startsAt"       TIMESTAMP(3),
  "expiresAt"      TIMESTAMP(3),
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "discount_codes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "discount_codes_code_key" ON "discount_codes"("code");

-- Snapshotted onto the subscription so an invoice still explains the amount
-- charged after the code itself is edited or deleted.
ALTER TABLE "subscriptions" ADD COLUMN "discountCodeId" TEXT;
ALTER TABLE "subscriptions" ADD COLUMN "discountHalalas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_discountCodeId_fkey"
  FOREIGN KEY ("discountCodeId") REFERENCES "discount_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
