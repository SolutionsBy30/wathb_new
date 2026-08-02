// Standalone, idempotent geography seed — safe to run repeatedly against a
// live database. Idempotency is per-row (find by name, create only when
// missing), not the old all-or-nothing "skip if any region exists" check,
// so re-running it tops up an existing registry with newly added cities
// without touching rows the admin has renamed/deactivated (matching is by
// current name, so a renamed row simply won't match and won't be recreated
// — deliberate: the admin's registry edits win over the seed).
//
// Coverage: all 13 KSA administrative regions and their major cities and
// governorates. Smaller centres/villages are left to the admin registry
// screen (or a CityAlias for variant spellings).
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const KSA_REGIONS: { nameAr: string; nameEn: string; cities: { nameAr: string; nameEn: string }[] }[] = [
  {
    nameAr: 'الرياض', nameEn: 'Riyadh',
    cities: [
      { nameAr: 'الرياض', nameEn: 'Riyadh' }, { nameAr: 'الخرج', nameEn: 'Al-Kharj' },
      { nameAr: 'الدرعية', nameEn: 'Diriyah' }, { nameAr: 'الدوادمي', nameEn: 'Ad-Dawadmi' },
      { nameAr: 'المجمعة', nameEn: 'Al Majmaah' }, { nameAr: 'القويعية', nameEn: 'Al Quwaiiyah' },
      { nameAr: 'وادي الدواسر', nameEn: 'Wadi ad-Dawasir' }, { nameAr: 'الأفلاج', nameEn: 'Al Aflaj' },
      { nameAr: 'الزلفي', nameEn: 'Az Zulfi' }, { nameAr: 'شقراء', nameEn: 'Shaqra' },
      { nameAr: 'حوطة بني تميم', nameEn: 'Hotat Bani Tamim' }, { nameAr: 'عفيف', nameEn: 'Afif' },
      { nameAr: 'السليل', nameEn: 'As Sulayyil' }, { nameAr: 'ضرماء', nameEn: 'Dhurma' },
      { nameAr: 'المزاحمية', nameEn: 'Al Muzahimiyah' }, { nameAr: 'رماح', nameEn: 'Rumah' },
      { nameAr: 'ثادق', nameEn: 'Thadiq' }, { nameAr: 'حريملاء', nameEn: 'Huraymila' },
      { nameAr: 'الحريق', nameEn: 'Al Hariq' }, { nameAr: 'مرات', nameEn: 'Marat' },
    ],
  },
  {
    nameAr: 'مكة المكرمة', nameEn: 'Makkah',
    cities: [
      { nameAr: 'مكة المكرمة', nameEn: 'Makkah' }, { nameAr: 'جدة', nameEn: 'Jeddah' },
      { nameAr: 'الطائف', nameEn: 'Taif' }, { nameAr: 'القنفذة', nameEn: 'Al Qunfudhah' },
      { nameAr: 'الليث', nameEn: 'Al Lith' }, { nameAr: 'رابغ', nameEn: 'Rabigh' },
      { nameAr: 'خليص', nameEn: 'Khulais' }, { nameAr: 'الخرمة', nameEn: 'Al Khurmah' },
      { nameAr: 'رنية', nameEn: 'Ranyah' }, { nameAr: 'تربة', nameEn: 'Turabah' },
      { nameAr: 'الجموم', nameEn: 'Al Jumum' }, { nameAr: 'الكامل', nameEn: 'Al Kamil' },
      { nameAr: 'المويه', nameEn: 'Al Muwayh' }, { nameAr: 'ميسان', nameEn: 'Maysan' },
      { nameAr: 'أضم', nameEn: 'Adham' }, { nameAr: 'بحرة', nameEn: 'Bahrah' },
    ],
  },
  {
    nameAr: 'المدينة المنورة', nameEn: 'Madinah',
    cities: [
      { nameAr: 'المدينة المنورة', nameEn: 'Madinah' }, { nameAr: 'ينبع', nameEn: 'Yanbu' },
      { nameAr: 'العلا', nameEn: 'AlUla' }, { nameAr: 'مهد الذهب', nameEn: 'Mahd adh-Dhahab' },
      { nameAr: 'الحناكية', nameEn: 'Al Hanakiyah' }, { nameAr: 'بدر', nameEn: 'Badr' },
      { nameAr: 'خيبر', nameEn: 'Khaybar' }, { nameAr: 'العيص', nameEn: 'Al Ais' },
      { nameAr: 'وادي الفرع', nameEn: 'Wadi al-Fara' },
    ],
  },
  {
    nameAr: 'القصيم', nameEn: 'Qassim',
    cities: [
      { nameAr: 'بريدة', nameEn: 'Buraidah' }, { nameAr: 'عنيزة', nameEn: 'Unaizah' },
      { nameAr: 'الرس', nameEn: 'Ar Rass' }, { nameAr: 'المذنب', nameEn: 'Al Mithnab' },
      { nameAr: 'البكيرية', nameEn: 'Al Bukayriyah' }, { nameAr: 'البدائع', nameEn: 'Al Badai' },
      { nameAr: 'الأسياح', nameEn: 'Al Asyah' }, { nameAr: 'النبهانية', nameEn: 'An Nabhaniyah' },
      { nameAr: 'عيون الجواء', nameEn: 'Uyun al-Jiwa' }, { nameAr: 'رياض الخبراء', nameEn: 'Riyadh al-Khabra' },
      { nameAr: 'الشماسية', nameEn: 'Ash Shimasiyah' }, { nameAr: 'ضرية', nameEn: 'Dariyah' },
    ],
  },
  {
    nameAr: 'الشرقية', nameEn: 'Eastern Province',
    cities: [
      { nameAr: 'الدمام', nameEn: 'Dammam' }, { nameAr: 'الخبر', nameEn: 'Al-Khobar' },
      { nameAr: 'الظهران', nameEn: 'Dhahran' }, { nameAr: 'الأحساء', nameEn: 'Al-Ahsa' },
      { nameAr: 'حفر الباطن', nameEn: 'Hafar al-Batin' }, { nameAr: 'الجبيل', nameEn: 'Jubail' },
      { nameAr: 'القطيف', nameEn: 'Qatif' }, { nameAr: 'الخفجي', nameEn: 'Khafji' },
      { nameAr: 'رأس تنورة', nameEn: 'Ras Tanura' }, { nameAr: 'بقيق', nameEn: 'Buqayq' },
      { nameAr: 'النعيرية', nameEn: 'An Nuayriyah' }, { nameAr: 'قرية العليا', nameEn: 'Qaryat al-Ulya' },
      { nameAr: 'سيهات', nameEn: 'Saihat' },
    ],
  },
  {
    nameAr: 'عسير', nameEn: 'Asir',
    cities: [
      { nameAr: 'أبها', nameEn: 'Abha' }, { nameAr: 'خميس مشيط', nameEn: 'Khamis Mushait' },
      { nameAr: 'بيشة', nameEn: 'Bisha' }, { nameAr: 'النماص', nameEn: 'An-Namas' },
      { nameAr: 'محايل عسير', nameEn: 'Muhayil Asir' }, { nameAr: 'ظهران الجنوب', nameEn: 'Dhahran al-Janub' },
      { nameAr: 'تثليث', nameEn: 'Tathlith' }, { nameAr: 'سراة عبيدة', nameEn: 'Sarat Abidah' },
      { nameAr: 'رجال ألمع', nameEn: 'Rijal Almaa' }, { nameAr: 'بلقرن', nameEn: 'Balqarn' },
      { nameAr: 'أحد رفيدة', nameEn: 'Ahad Rafidah' }, { nameAr: 'المجاردة', nameEn: 'Al Majardah' },
      { nameAr: 'بارق', nameEn: 'Bariq' }, { nameAr: 'تنومة', nameEn: 'Tanomah' },
    ],
  },
  {
    nameAr: 'تبوك', nameEn: 'Tabuk',
    cities: [
      { nameAr: 'تبوك', nameEn: 'Tabuk' }, { nameAr: 'الوجه', nameEn: 'Al Wajh' },
      { nameAr: 'ضباء', nameEn: 'Duba' }, { nameAr: 'تيماء', nameEn: 'Tayma' },
      { nameAr: 'أملج', nameEn: 'Umluj' }, { nameAr: 'حقل', nameEn: 'Haql' },
      { nameAr: 'البدع', nameEn: 'Al Bada' },
    ],
  },
  {
    nameAr: 'حائل', nameEn: 'Hail',
    cities: [
      { nameAr: 'حائل', nameEn: 'Hail' }, { nameAr: 'بقعاء', nameEn: 'Baqaa' },
      { nameAr: 'الغزالة', nameEn: 'Al Ghazalah' }, { nameAr: 'الشنان', nameEn: 'Ash Shinan' },
      { nameAr: 'السليمي', nameEn: 'As Sulaimi' }, { nameAr: 'الحائط', nameEn: 'Al Hait' },
      { nameAr: 'الشملي', nameEn: 'Ash Shamli' }, { nameAr: 'موقق', nameEn: 'Mawqaq' },
    ],
  },
  {
    nameAr: 'الحدود الشمالية', nameEn: 'Northern Borders',
    cities: [
      { nameAr: 'عرعر', nameEn: "Ar'ar" }, { nameAr: 'رفحاء', nameEn: 'Rafha' },
      { nameAr: 'طريف', nameEn: 'Turaif' }, { nameAr: 'العويقيلة', nameEn: 'Al Uwayqilah' },
    ],
  },
  {
    nameAr: 'جازان', nameEn: 'Jazan',
    cities: [
      { nameAr: 'جازان', nameEn: 'Jazan' }, { nameAr: 'صبيا', nameEn: 'Sabya' },
      { nameAr: 'أبو عريش', nameEn: 'Abu Arish' }, { nameAr: 'صامطة', nameEn: 'Samtah' },
      { nameAr: 'أحد المسارحة', nameEn: 'Ahad al-Masarihah' }, { nameAr: 'بيش', nameEn: 'Baish' },
      { nameAr: 'الدرب', nameEn: 'Ad-Darb' }, { nameAr: 'ضمد', nameEn: 'Damad' },
      { nameAr: 'الحرث', nameEn: 'Al Harth' }, { nameAr: 'فرسان', nameEn: 'Farasan' },
      { nameAr: 'العارضة', nameEn: 'Al Aridhah' }, { nameAr: 'العيدابي', nameEn: 'Al Aydabi' },
      { nameAr: 'فيفاء', nameEn: 'Fifa' }, { nameAr: 'الريث', nameEn: 'Ar Rayth' },
    ],
  },
  {
    nameAr: 'نجران', nameEn: 'Najran',
    cities: [
      { nameAr: 'نجران', nameEn: 'Najran' }, { nameAr: 'شرورة', nameEn: 'Sharurah' },
      { nameAr: 'حبونا', nameEn: 'Hubuna' }, { nameAr: 'بدر الجنوب', nameEn: 'Badr al-Janub' },
      { nameAr: 'يدمة', nameEn: 'Yadamah' }, { nameAr: 'ثار', nameEn: 'Thar' },
      { nameAr: 'خباش', nameEn: 'Khubash' },
    ],
  },
  {
    nameAr: 'الباحة', nameEn: 'Al Bahah',
    cities: [
      { nameAr: 'الباحة', nameEn: 'Al Bahah' }, { nameAr: 'بلجرشي', nameEn: 'Baljurashi' },
      { nameAr: 'المندق', nameEn: 'Al Mandaq' }, { nameAr: 'المخواة', nameEn: 'Al Makhwah' },
      { nameAr: 'قلوة', nameEn: 'Qilwah' }, { nameAr: 'العقيق', nameEn: 'Al Aqiq' },
      { nameAr: 'القرى', nameEn: 'Al Qura' },
    ],
  },
  {
    nameAr: 'الجوف', nameEn: 'Al Jawf',
    cities: [
      { nameAr: 'سكاكا', nameEn: 'Sakaka' }, { nameAr: 'القريات', nameEn: 'Al Qurayyat' },
      { nameAr: 'دومة الجندل', nameEn: 'Dumat al-Jandal' }, { nameAr: 'طبرجل', nameEn: 'Tabarjal' },
    ],
  },
];

async function main() {
  let regionsCreated = 0;
  let citiesCreated = 0;
  for (const r of KSA_REGIONS) {
    let region = await prisma.region.findFirst({ where: { nameAr: r.nameAr } });
    if (!region) {
      region = await prisma.region.create({ data: { nameAr: r.nameAr, nameEn: r.nameEn } });
      regionsCreated++;
    }
    for (const c of r.cities) {
      const existing = await prisma.city.findFirst({ where: { regionId: region.id, nameAr: c.nameAr } });
      if (!existing) {
        await prisma.city.create({ data: { regionId: region.id, nameAr: c.nameAr, nameEn: c.nameEn } });
        citiesCreated++;
      }
    }
  }
  const totals = { regions: await prisma.region.count(), cities: await prisma.city.count() };
  console.log(`Geography seed: +${regionsCreated} regions, +${citiesCreated} cities (now ${totals.regions} regions, ${totals.cities} cities).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
