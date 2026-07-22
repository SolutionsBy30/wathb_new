// Standalone, idempotent geography seed — for populating regions/cities on
// an existing production database (post-migration) without re-running the
// full seed.ts, which would fail on already-existing admin/demo accounts.
// Safe to run more than once: skips entirely if any region already exists.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const KSA_REGIONS = [
  { nameAr: 'الرياض', nameEn: 'Riyadh', cities: [{ nameAr: 'الرياض', nameEn: 'Riyadh' }, { nameAr: 'الخرج', nameEn: 'Al-Kharj' }] },
  { nameAr: 'مكة المكرمة', nameEn: 'Makkah', cities: [{ nameAr: 'جدة', nameEn: 'Jeddah' }, { nameAr: 'مكة المكرمة', nameEn: 'Makkah' }] },
  { nameAr: 'المدينة المنورة', nameEn: 'Madinah', cities: [{ nameAr: 'المدينة المنورة', nameEn: 'Madinah' }] },
  { nameAr: 'الشرقية', nameEn: 'Eastern Province', cities: [{ nameAr: 'الدمام', nameEn: 'Dammam' }, { nameAr: 'الخبر', nameEn: 'Al-Khobar' }] },
  { nameAr: 'عسير', nameEn: 'Asir', cities: [{ nameAr: 'أبها', nameEn: 'Abha' }] },
  { nameAr: 'تبوك', nameEn: 'Tabuk', cities: [{ nameAr: 'تبوك', nameEn: 'Tabuk' }] },
  { nameAr: 'حائل', nameEn: 'Hail', cities: [{ nameAr: 'حائل', nameEn: 'Hail' }] },
  { nameAr: 'الحدود الشمالية', nameEn: 'Northern Borders', cities: [{ nameAr: 'عرعر', nameEn: "Ar'ar" }] },
  { nameAr: 'جازان', nameEn: 'Jazan', cities: [{ nameAr: 'جازان', nameEn: 'Jazan' }] },
  { nameAr: 'نجران', nameEn: 'Najran', cities: [{ nameAr: 'نجران', nameEn: 'Najran' }] },
  { nameAr: 'الباحة', nameEn: 'Al Bahah', cities: [{ nameAr: 'الباحة', nameEn: 'Al Bahah' }] },
  { nameAr: 'الجوف', nameEn: 'Al Jawf', cities: [{ nameAr: 'سكاكا', nameEn: 'Sakaka' }] },
  { nameAr: 'القصيم', nameEn: 'Qassim', cities: [{ nameAr: 'بريدة', nameEn: 'Buraidah' }] },
];

async function main() {
  const existing = await prisma.region.count();
  if (existing > 0) {
    console.log(`Regions already present (${existing}) — skipping, nothing to do.`);
    return;
  }
  for (const r of KSA_REGIONS) {
    const region = await prisma.region.create({ data: { nameAr: r.nameAr, nameEn: r.nameEn } });
    for (const c of r.cities) {
      await prisma.city.create({ data: { regionId: region.id, nameAr: c.nameAr, nameEn: c.nameEn } });
    }
  }
  console.log(`Seeded ${KSA_REGIONS.length} regions and their cities. Add real schools from the admin "الجغرافيا والمدارس" screen.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
