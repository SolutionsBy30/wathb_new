-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('daily_wathb', 'nudge', 'weekly_report_student', 'weekly_report_supervisor', 'streak_milestone', 'subscription_expiring', 'payment_failed', 'supervisor_invite', 'suspension');

-- CreateEnum
CREATE TYPE "NotifChannel" AS ENUM ('whatsapp_template', 'whatsapp_freeform', 'console');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('utility', 'marketing');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('scheduled', 'sent', 'delivered', 'read', 'failed');

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "channel" "NotifChannel" NOT NULL,
    "templateName" TEXT,
    "category" "NotificationCategory" NOT NULL,
    "waMessageId" TEXT,
    "scheduledFor" DATE NOT NULL,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),
    "wasBillable" BOOLEAN NOT NULL DEFAULT false,
    "costEstimate" DOUBLE PRECISION,
    "status" "NotificationStatus" NOT NULL DEFAULT 'scheduled',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wa_sessions" (
    "userId" TEXT NOT NULL,
    "windowOpenedAt" TIMESTAMP(3),
    "windowExpiresAt" TIMESTAMP(3),
    "lastInboundAt" TIMESTAMP(3),

    CONSTRAINT "wa_sessions_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_userId_kind_scheduledFor_key" ON "notifications"("userId", "kind", "scheduledFor");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_sessions" ADD CONSTRAINT "wa_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
