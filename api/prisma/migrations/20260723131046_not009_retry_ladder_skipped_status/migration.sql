-- AlterEnum
ALTER TYPE "NotificationStatus" ADD VALUE 'skipped';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "notifications_status_nextRetryAt_idx" ON "notifications"("status", "nextRetryAt");
