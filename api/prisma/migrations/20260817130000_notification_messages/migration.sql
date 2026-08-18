-- NOT-017 — admin-authored variants of the daily leap message.
CREATE TABLE "notification_messages" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'daily_wathb',
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_messages_kind_isActive_idx" ON "notification_messages"("kind", "isActive");

-- Deliberately seeded empty: with no rows the sender falls back to the
-- built-in wording, so this migration changes no message until an admin
-- writes one.
