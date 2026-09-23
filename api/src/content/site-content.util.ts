/**
 * CMS-001 — the landing page's editable copy.
 *
 * Every string on the public page was a literal in the React bundle, so
 * changing a headline meant a deploy. That is the wrong shape for marketing
 * copy: it changes far more often than the code around it, and the person who
 * wants it changed is not the person who can deploy.
 *
 * The keys live here rather than in the console, so the admin screen renders
 * itself from this list and the two cannot drift. Adding a key is one entry
 * plus a migration row, and the default below keeps the page whole in the gap
 * between deploying the key and seeding its value.
 */

export interface ContentKeyDef {
  key: string;
  /** What the admin screen calls it. */
  labelAr: string;
  /** Rendered when nothing is stored, so the page is never blank. */
  defaultAr: string;
  /** A textarea rather than a single line. */
  multiline?: boolean;
  /** Which part of the page it belongs to, for grouping the editor. */
  section: 'hero' | 'features' | 'groups' | 'pricing' | 'footer';
  /** One line of guidance where the field's effect is not obvious. */
  hintAr?: string;
}

export const SITE_CONTENT_KEYS: ContentKeyDef[] = [
  { section: 'hero', key: 'hero.badge', labelAr: 'الشارة أعلى العنوان', defaultAr: 'طريقك للوصول لنسبة 100%' },
  { section: 'hero', key: 'hero.headline', labelAr: 'العنوان الرئيسي', defaultAr: 'كل يوم وثبة. وثبة واحدة في النهاية.' },
  {
    section: 'hero',
    key: 'hero.sub',
    labelAr: 'النص تحت العنوان',
    defaultAr: 'خمسة أسئلة يومية، ثماني دقائق، وتقرير أسبوعي يوضح لولي الأمر أين وصل ابنه. لا حشو، لا ضغط — تدريب يومي يبني نتيجة حقيقية.',
    multiline: true,
  },
  { section: 'hero', key: 'hero.ctaPrimary', labelAr: 'زر البدء', defaultAr: 'ابدأ الوثبة الآن' },
  { section: 'hero', key: 'hero.ctaSecondary', labelAr: 'الزر الثانوي', defaultAr: 'عرض الأسعار' },

  { section: 'features', key: 'features.heading', labelAr: 'عنوان قسم المميزات', defaultAr: 'مصمم لثلاث جهات' },
  {
    section: 'features',
    key: 'features.sub',
    labelAr: 'وصف قسم المميزات',
    defaultAr: 'الطالب يتدرب، ولي الأمر يتابع، المدرسة تراقب الفصل بأكمله.',
    multiline: true,
  },

  {
    section: 'groups',
    key: 'groups.heading',
    labelAr: 'عنوان قسم الاختبارات',
    defaultAr: 'اختبارات نغطّيها',
    hintAr: 'تظهر تحته مجموعات الاختبارات — كل مجموعة بقسم خاص بها. أسماء المجموعات ووصفها تُحرَّر من شاشة «الاختبارات والتصنيف».',
  },
  {
    section: 'groups',
    key: 'groups.sub',
    labelAr: 'وصف قسم الاختبارات',
    defaultAr: 'من اختبارات الثانوية إلى الشهادات المهنية — نبقى معك كلما تغيّر هدفك.',
    multiline: true,
  },

  {
    section: 'pricing',
    key: 'pricing.heading',
    labelAr: 'عنوان الشريط الختامي',
    defaultAr: 'اشتراك بسيط، بلا التزامات معقّدة',
    hintAr: 'يظهر بعد أقسام المجموعات، أسفل الصفحة مباشرة. أسعار الباقات ومميزاتها تُحرَّر من شاشة «الباقات».',
  },
  {
    section: 'pricing',
    key: 'pricing.sub',
    labelAr: 'وصف الشريط الختامي',
    defaultAr: 'إلغاء في أي وقت، ويمكنك الاشتراك في أكثر من باقة إذا كنت تستعد لأكثر من اختبار.',
    multiline: true,
  },

  { section: 'footer', key: 'footer.text', labelAr: 'نص التذييل', defaultAr: '© 2026 وثب. كل يوم وثبة.' },
];

const BY_KEY = new Map(SITE_CONTENT_KEYS.map((d) => [d.key, d]));

export function isKnownKey(key: string): boolean {
  return BY_KEY.has(key);
}

/**
 * Stored values over defaults, and a default for anything unstored.
 *
 * An empty or whitespace-only stored value falls back too: clearing a field is
 * far more likely to be an accident than a deliberate request for a blank
 * headline, and a page with an empty hero looks broken rather than minimal.
 */
export function withDefaults(rows: { key: string; valueAr: string }[]): Record<string, string> {
  const stored = new Map(rows.map((r) => [r.key, r.valueAr]));
  const out: Record<string, string> = {};
  for (const def of SITE_CONTENT_KEYS) {
    const v = stored.get(def.key);
    out[def.key] = v && v.trim() ? v : def.defaultAr;
  }
  return out;
}
