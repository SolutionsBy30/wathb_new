-- ADM-094 — segment the test catalogue.

CREATE TABLE "test_groups" (
    "id" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "descriptionAr" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "test_groups_pkey" PRIMARY KEY ("id")
);

-- Nullable, and left null for every existing test: grouping is new, and
-- assigning one at migration time would be guessing which segment a test
-- belongs to. SET NULL on delete so removing a group ungroups its tests
-- rather than deleting them.
ALTER TABLE "tests" ADD COLUMN "groupId" TEXT;

ALTER TABLE "tests" ADD CONSTRAINT "tests_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "test_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tests_groupId_idx" ON "tests"("groupId");
