-- AlterTable
ALTER TABLE "cities" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "regions" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "city_aliases" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,

    CONSTRAINT "city_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "city_aliases_alias_key" ON "city_aliases"("alias");

-- AddForeignKey
ALTER TABLE "city_aliases" ADD CONSTRAINT "city_aliases_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
