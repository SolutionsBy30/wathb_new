-- SCH — the school dashboard.
--
-- Additive. Identity disclosure defaults to 'none', so every existing school
-- sees aggregates and pseudonyms only until a وثب admin decides otherwise —
-- the safe direction for a default that governs minors' data.
CREATE TYPE "SchoolIdentityDisclosure" AS ENUM ('none', 'consented', 'full');

ALTER TABLE "schools" ADD COLUMN "identityDisclosure" "SchoolIdentityDisclosure" NOT NULL DEFAULT 'none';

ALTER TABLE "students" ADD COLUMN "schoolShareConsentAt" TIMESTAMP(3);
ALTER TABLE "students" ADD COLUMN "schoolShareOptOutAt" TIMESTAMP(3);

CREATE TABLE "school_admins" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    CONSTRAINT "school_admins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "school_admins_userId_schoolId_key" ON "school_admins"("userId", "schoolId");
CREATE INDEX "school_admins_schoolId_isActive_idx" ON "school_admins"("schoolId", "isActive");

ALTER TABLE "school_admins" ADD CONSTRAINT "school_admins_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "school_admins" ADD CONSTRAINT "school_admins_schoolId_fkey"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
