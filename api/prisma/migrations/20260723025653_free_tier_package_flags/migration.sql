-- CreateEnum
CREATE TYPE "ReportVisibility" AS ENUM ('full', 'partial');

-- AlterTable
ALTER TABLE "packages" ADD COLUMN     "dailyNotificationEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reportVisibility" "ReportVisibility" NOT NULL DEFAULT 'full',
ADD COLUMN     "supervisorLinkingAllowed" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "weeklyReportEnabled" BOOLEAN NOT NULL DEFAULT true;
