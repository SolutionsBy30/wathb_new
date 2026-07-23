-- CreateEnum
CREATE TYPE "ContentLanguage" AS ENUM ('ar', 'en');

-- AlterTable
ALTER TABLE "tests" ADD COLUMN     "language" "ContentLanguage" NOT NULL DEFAULT 'ar';
