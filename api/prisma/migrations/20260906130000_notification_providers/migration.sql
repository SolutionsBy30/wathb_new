-- NOT-023 — admin-managed WhatsApp senders with a backup.
CREATE TABLE "notification_providers" (
    "id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'wasender',
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "apiKey" TEXT,
    "baseUrl" TEXT,
    "statusPath" TEXT,
    "accessToken" TEXT,
    "phoneNumberId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unknown',
    "lastCheckedAt" TIMESTAMP(3),
    "lastOkAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "notification_providers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_providers_role_key" ON "notification_providers"("role");

-- Seeded empty on purpose. With no rows the sender keeps using the .env
-- configuration exactly as before, so this migration changes no behaviour; the
-- primary row is created from .env the first time the console is opened.
