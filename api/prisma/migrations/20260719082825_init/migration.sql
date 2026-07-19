-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'supervisor', 'student');

-- CreateEnum
CREATE TYPE "SupervisorType" AS ENUM ('parent', 'instructor');

-- CreateEnum
CREATE TYPE "Track" AS ENUM ('scientific', 'humanities');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('mcq_single', 'mcq_multi', 'numeric_entry', 'true_false');

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('draft', 'in_review', 'published', 'retired');

-- CreateEnum
CREATE TYPE "BundleType" AS ENUM ('standard', 'passage', 'placement');

-- CreateEnum
CREATE TYPE "WathbStatus" AS ENUM ('pending', 'opened', 'completed', 'expired', 'partial');

-- CreateEnum
CREATE TYPE "MagicLinkPurpose" AS ENUM ('wathb', 'weekly_report', 'supervisor_report', 'renewal', 'link_invite');

-- CreateEnum
CREATE TYPE "SubjectType" AS ENUM ('student', 'supervisor');

-- CreateEnum
CREATE TYPE "AccuracyBand" AS ENUM ('low', 'mid', 'high');

-- CreateEnum
CREATE TYPE "SpeedBand" AS ENUM ('slow', 'on_pace', 'fast');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('daily_wathb', 'nudge', 'weekly_report_student', 'weekly_report_supervisor', 'streak_milestone', 'subscription_expiring', 'payment_failed', 'supervisor_invite', 'suspension');

-- CreateEnum
CREATE TYPE "NotifChannel" AS ENUM ('whatsapp_template', 'whatsapp_freeform', 'console');

-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('utility', 'marketing');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('scheduled', 'sent', 'delivered', 'read', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "mobileE164" TEXT,
    "email" TEXT,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    "status" TEXT NOT NULL DEFAULT 'active',
    "whatsappOptInAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "students" (
    "userId" TEXT NOT NULL,
    "track" "Track",
    "targetTestId" TEXT,
    "targetScore" INTEGER,
    "testDate" TIMESTAMP(3),
    "skipDays" INTEGER[] DEFAULT ARRAY[5]::INTEGER[],
    "notifSlotStartHour" INTEGER NOT NULL DEFAULT 18,
    "notifSlotEndHour" INTEGER NOT NULL DEFAULT 20,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "lastCompletedOn" TIMESTAMP(3),
    "placementDoneAt" TIMESTAMP(3),

    CONSTRAINT "students_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "supervisors" (
    "userId" TEXT NOT NULL,
    "type" "SupervisorType" NOT NULL,

    CONSTRAINT "supervisors_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "student_supervisors" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "student_supervisors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tests" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "appliesToTracks" "Track"[],
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labels" (
    "id" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "defaultTimeLimitS" INTEGER NOT NULL DEFAULT 45,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "isRetired" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "labels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passages" (
    "id" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'draft',

    CONSTRAINT "passages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "passageId" TEXT,
    "type" "QuestionType" NOT NULL DEFAULT 'mcq_single',
    "difficulty" INTEGER NOT NULL DEFAULT 3,
    "timeLimitS" INTEGER,
    "status" "QuestionStatus" NOT NULL DEFAULT 'draft',
    "source" TEXT,
    "stemHash" TEXT NOT NULL,
    "currentVersionId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_versions" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "stem" TEXT NOT NULL,
    "stemImageUrl" TEXT,
    "options" JSONB NOT NULL,
    "correctKey" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "question_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wathbs" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "scheduledFor" DATE NOT NULL,
    "bundleType" "BundleType" NOT NULL DEFAULT 'standard',
    "status" "WathbStatus" NOT NULL DEFAULT 'pending',
    "openedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "magicLinkId" TEXT,

    CONSTRAINT "wathbs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wathb_questions" (
    "id" TEXT NOT NULL,
    "wathbId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionVersionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "servedAt" TIMESTAMP(3),

    CONSTRAINT "wathb_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answers" (
    "id" TEXT NOT NULL,
    "wathbId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionVersionId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "selectedKey" TEXT,
    "isCorrect" BOOLEAN NOT NULL,
    "timeTakenMs" INTEGER NOT NULL,
    "timedOut" BOOLEAN NOT NULL DEFAULT false,
    "isReview" BOOLEAN NOT NULL DEFAULT false,
    "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magic_links" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "subjectType" "SubjectType" NOT NULL,
    "purpose" "MagicLinkPurpose" NOT NULL,
    "targetId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "firstUsedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magic_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "magic_link_access" (
    "id" TEXT NOT NULL,
    "magicLinkId" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "magic_link_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_label_stats" (
    "studentId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "nAnswered" INTEGER NOT NULL DEFAULT 0,
    "nCorrect" INTEGER NOT NULL DEFAULT 0,
    "meanTimeMs" INTEGER NOT NULL DEFAULT 0,
    "difficultyLevel" INTEGER NOT NULL DEFAULT 3,
    "lastServedAt" TIMESTAMP(3),

    CONSTRAINT "student_label_stats_pkey" PRIMARY KEY ("studentId","labelId")
);

-- CreateTable
CREATE TABLE "advice_rules" (
    "id" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "accuracyBand" "AccuracyBand" NOT NULL,
    "speedBand" "SpeedBand" NOT NULL,
    "textAr" TEXT NOT NULL,
    "textEn" TEXT NOT NULL,

    CONSTRAINT "advice_rules_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "mobileE164" TEXT NOT NULL,
    "subjectType" "SubjectType" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_mobileE164_key" ON "users"("mobileE164");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "student_supervisors_studentId_supervisorId_key" ON "student_supervisors"("studentId", "supervisorId");

-- CreateIndex
CREATE INDEX "questions_labelId_status_idx" ON "questions"("labelId", "status");

-- CreateIndex
CREATE INDEX "questions_stemHash_idx" ON "questions"("stemHash");

-- CreateIndex
CREATE UNIQUE INDEX "question_versions_questionId_version_key" ON "question_versions"("questionId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "wathbs_studentId_scheduledFor_key" ON "wathbs"("studentId", "scheduledFor");

-- CreateIndex
CREATE UNIQUE INDEX "wathb_questions_wathbId_position_key" ON "wathb_questions"("wathbId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "answers_wathbId_questionId_key" ON "answers"("wathbId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "magic_links_tokenHash_key" ON "magic_links"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "advice_rules_labelId_accuracyBand_speedBand_key" ON "advice_rules"("labelId", "accuracyBand", "speedBand");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_userId_kind_scheduledFor_key" ON "notifications"("userId", "kind", "scheduledFor");

-- CreateIndex
CREATE INDEX "otp_codes_mobileE164_subjectType_idx" ON "otp_codes"("mobileE164", "subjectType");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_targetTestId_fkey" FOREIGN KEY ("targetTestId") REFERENCES "tests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisors" ADD CONSTRAINT "supervisors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_supervisors" ADD CONSTRAINT "student_supervisors_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_supervisors" ADD CONSTRAINT "student_supervisors_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "supervisors"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "areas" ADD CONSTRAINT "areas_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "labels" ADD CONSTRAINT "labels_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passages" ADD CONSTRAINT "passages_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "labels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "labels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_passageId_fkey" FOREIGN KEY ("passageId") REFERENCES "passages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_versions" ADD CONSTRAINT "question_versions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wathbs" ADD CONSTRAINT "wathbs_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wathb_questions" ADD CONSTRAINT "wathb_questions_wathbId_fkey" FOREIGN KEY ("wathbId") REFERENCES "wathbs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wathb_questions" ADD CONSTRAINT "wathb_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wathb_questions" ADD CONSTRAINT "wathb_questions_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "question_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_wathbId_fkey" FOREIGN KEY ("wathbId") REFERENCES "wathbs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answers" ADD CONSTRAINT "answers_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "question_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "magic_link_access" ADD CONSTRAINT "magic_link_access_magicLinkId_fkey" FOREIGN KEY ("magicLinkId") REFERENCES "magic_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_label_stats" ADD CONSTRAINT "student_label_stats_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_label_stats" ADD CONSTRAINT "student_label_stats_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advice_rules" ADD CONSTRAINT "advice_rules_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "labels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wa_sessions" ADD CONSTRAINT "wa_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
