-- DropIndex
DROP INDEX "wathbs_studentId_scheduledFor_key";

-- AlterTable
ALTER TABLE "wathbs" ADD COLUMN     "sequence" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "daily_tips" (
    "id" TEXT NOT NULL,
    "textAr" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_tips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wathbs_studentId_scheduledFor_sequence_key" ON "wathbs"("studentId", "scheduledFor", "sequence");

