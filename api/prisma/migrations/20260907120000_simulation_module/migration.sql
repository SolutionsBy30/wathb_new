-- SIM-001 — المحاكي: blueprint-driven exam simulation.
--
-- Additive only: no existing table is altered, so deploying this changes no
-- current behaviour. Nothing is seeded — a blueprint is authored in the admin
-- console, and until one is published the feature is invisible to students.

-- CreateEnum
CREATE TYPE "SimulationMode" AS ENUM ('computerized', 'paper');

-- CreateEnum
CREATE TYPE "SimulationStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "SimulationAttemptStatus" AS ENUM ('not_started', 'in_progress', 'completed', 'expired', 'abandoned');

-- CreateEnum
CREATE TYPE "SectionLockReason" AS ENUM ('manual', 'timeout', 'abandon');

-- CreateEnum
CREATE TYPE "NavigationPolicy" AS ENUM ('free_within_section', 'linear_only');

-- CreateTable
CREATE TABLE "simulation_blueprints" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "mode" "SimulationMode" NOT NULL DEFAULT 'computerized',
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "sectionCount" INTEGER NOT NULL,
    "sectionDurationS" INTEGER NOT NULL DEFAULT 1500,
    "breakBetweenSections" BOOLEAN NOT NULL DEFAULT false,
    "breakDurationS" INTEGER NOT NULL DEFAULT 0,
    "navigationPolicy" "NavigationPolicy" NOT NULL DEFAULT 'free_within_section',
    "allowFlagReview" BOOLEAN NOT NULL DEFAULT true,
    "calculatorAllowed" BOOLEAN NOT NULL DEFAULT false,
    "scratchpad" TEXT NOT NULL DEFAULT 'digital',
    "difficultyOrdering" TEXT NOT NULL DEFAULT 'ascending',
    "experimentalCount" INTEGER NOT NULL DEFAULT 4,
    "minCompletedLeaps" INTEGER NOT NULL DEFAULT 20,
    "minAnsweredQuestions" INTEGER NOT NULL DEFAULT 100,
    "minCoverageAreas" BOOLEAN NOT NULL DEFAULT false,
    "minDaysBetweenAttempts" INTEGER NOT NULL DEFAULT 7,
    "minLeapsBetweenAttempts" INTEGER NOT NULL DEFAULT 7,
    "requirePlacement" BOOLEAN NOT NULL DEFAULT true,
    "status" "SimulationStatus" NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "simulation_blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_section_templates" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "part" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "durationS" INTEGER NOT NULL,
    "experimentalSlots" INTEGER[] DEFAULT ARRAY[]::INTEGER[],

CONSTRAINT "simulation_section_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_area_quotas" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "areaId" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "difficultyCurve" TEXT NOT NULL DEFAULT 'ascending',

CONSTRAINT "simulation_area_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_forms" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isStatic" BOOLEAN NOT NULL DEFAULT true,
    "seed" TEXT NOT NULL,
    "status" "SimulationStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "forStudentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "simulation_forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_form_items" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "sectionIndex" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionVersionId" TEXT NOT NULL,
    "isScored" BOOLEAN NOT NULL DEFAULT true,

CONSTRAINT "simulation_form_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_attempts" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "status" "SimulationAttemptStatus" NOT NULL DEFAULT 'not_started',
    "startedAt" TIMESTAMP(3),
    "finalizedAt" TIMESTAMP(3),
    "entitlementId" TEXT,
    "schoolSnapshot" TEXT,
    "citySnapshot" TEXT,
    "regionSnapshot" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "simulation_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_attempt_sections" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "sectionIndex" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "lockReason" "SectionLockReason",

CONSTRAINT "simulation_attempt_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_answers" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "formItemId" TEXT NOT NULL,
    "selectedKey" TEXT,
    "isCorrect" BOOLEAN,
    "timeSpentMs" INTEGER NOT NULL DEFAULT 0,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "answerChangesCount" INTEGER NOT NULL DEFAULT 0,
    "answeredAt" TIMESTAMP(3),

CONSTRAINT "simulation_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_results" (
    "attemptId" TEXT NOT NULL,
    "rawScore" INTEGER NOT NULL,
    "scoredCount" INTEGER NOT NULL,
    "scaledEstimate" INTEGER,
    "verbalEstimate" INTEGER,
    "quantEstimate" INTEGER,
    "areaBreakdown" JSONB NOT NULL,
    "sectionBreakdown" JSONB NOT NULL,
    "pacing" JSONB NOT NULL,
    "percentile" DOUBLE PRECISION,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "simulation_results_pkey" PRIMARY KEY ("attemptId")
);

-- CreateTable
CREATE TABLE "simulation_event_logs" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "detail" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "simulation_event_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_overrides" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "grantedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

CONSTRAINT "simulation_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scoring_profiles" (
    "id" TEXT NOT NULL,
    "blueprintId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "rawToScaled" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "scoring_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "simulation_blueprints_testId_status_idx" ON "simulation_blueprints"("testId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_section_templates_blueprintId_orderIndex_key" ON "simulation_section_templates"("blueprintId", "orderIndex");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_area_quotas_sectionId_areaId_key" ON "simulation_area_quotas"("sectionId", "areaId");

-- CreateIndex
CREATE INDEX "simulation_forms_blueprintId_status_idx" ON "simulation_forms"("blueprintId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_forms_blueprintId_code_key" ON "simulation_forms"("blueprintId", "code");

-- CreateIndex
CREATE INDEX "simulation_form_items_questionId_idx" ON "simulation_form_items"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_form_items_formId_sectionIndex_position_key" ON "simulation_form_items"("formId", "sectionIndex", "position");

-- CreateIndex
CREATE INDEX "simulation_attempts_studentId_status_idx" ON "simulation_attempts"("studentId", "status");

-- CreateIndex
CREATE INDEX "simulation_attempts_formId_idx" ON "simulation_attempts"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_attempt_sections_attemptId_sectionIndex_key" ON "simulation_attempt_sections"("attemptId", "sectionIndex");

-- CreateIndex
CREATE UNIQUE INDEX "simulation_answers_attemptId_formItemId_key" ON "simulation_answers"("attemptId", "formItemId");

-- CreateIndex
CREATE INDEX "simulation_event_logs_attemptId_at_idx" ON "simulation_event_logs"("attemptId", "at");

-- CreateIndex
CREATE INDEX "simulation_overrides_studentId_blueprintId_idx" ON "simulation_overrides"("studentId", "blueprintId");

-- CreateIndex
CREATE UNIQUE INDEX "scoring_profiles_blueprintId_version_key" ON "scoring_profiles"("blueprintId", "version");

-- AddForeignKey
ALTER TABLE "simulation_blueprints" ADD CONSTRAINT "simulation_blueprints_testId_fkey" FOREIGN KEY ("testId") REFERENCES "tests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_section_templates" ADD CONSTRAINT "simulation_section_templates_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "simulation_blueprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_area_quotas" ADD CONSTRAINT "simulation_area_quotas_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "simulation_section_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_area_quotas" ADD CONSTRAINT "simulation_area_quotas_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_forms" ADD CONSTRAINT "simulation_forms_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "simulation_blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_form_items" ADD CONSTRAINT "simulation_form_items_formId_fkey" FOREIGN KEY ("formId") REFERENCES "simulation_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_form_items" ADD CONSTRAINT "simulation_form_items_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_form_items" ADD CONSTRAINT "simulation_form_items_questionVersionId_fkey" FOREIGN KEY ("questionVersionId") REFERENCES "question_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_attempts" ADD CONSTRAINT "simulation_attempts_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_attempts" ADD CONSTRAINT "simulation_attempts_formId_fkey" FOREIGN KEY ("formId") REFERENCES "simulation_forms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_attempts" ADD CONSTRAINT "simulation_attempts_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "simulation_blueprints"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_attempt_sections" ADD CONSTRAINT "simulation_attempt_sections_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "simulation_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_answers" ADD CONSTRAINT "simulation_answers_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "simulation_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_answers" ADD CONSTRAINT "simulation_answers_formItemId_fkey" FOREIGN KEY ("formItemId") REFERENCES "simulation_form_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_results" ADD CONSTRAINT "simulation_results_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "simulation_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_event_logs" ADD CONSTRAINT "simulation_event_logs_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "simulation_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_overrides" ADD CONSTRAINT "simulation_overrides_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "students"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_overrides" ADD CONSTRAINT "simulation_overrides_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "simulation_blueprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scoring_profiles" ADD CONSTRAINT "scoring_profiles_blueprintId_fkey" FOREIGN KEY ("blueprintId") REFERENCES "simulation_blueprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
