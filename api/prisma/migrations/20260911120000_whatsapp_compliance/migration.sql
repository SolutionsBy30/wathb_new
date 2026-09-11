-- COM — WhatsApp sending hygiene.
--
-- Additive throughout. Every default reproduces today's behaviour exactly:
-- nobody is suppressed, no sender is capped, and no warm-up is in progress,
-- so applying this migration changes nothing until an admin configures it.
ALTER TABLE "users" ADD COLUMN "whatsappSuppressedAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "whatsappFailedRuns" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "whatsappReachable" BOOLEAN;
ALTER TABLE "users" ADD COLUMN "whatsappCheckedAt" TIMESTAMP(3);

ALTER TABLE "notification_providers" ADD COLUMN "dailyCap" INTEGER;
ALTER TABLE "notification_providers" ADD COLUMN "warmupStartedAt" TIMESTAMP(3);
