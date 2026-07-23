-- AlterTable
ALTER TABLE "question_stats" ADD COLUMN     "explanationDownvotes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "explanationUpvotes" INTEGER NOT NULL DEFAULT 0;
