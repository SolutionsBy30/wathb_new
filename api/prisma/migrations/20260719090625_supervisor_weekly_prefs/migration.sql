-- AlterTable
ALTER TABLE "supervisors" ADD COLUMN     "weeklyReportDay" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "weeklyReportHour" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "weeklyReportMuted" BOOLEAN NOT NULL DEFAULT false;
