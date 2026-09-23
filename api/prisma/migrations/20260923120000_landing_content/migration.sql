-- CMS-001 — landing-page copy an admin can edit without a deploy.

CREATE TABLE "site_content" (
    "key" TEXT NOT NULL,
    "valueAr" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_content_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "landing_features" (
    "id" TEXT NOT NULL,
    "titleAr" TEXT NOT NULL,
    "bodyAr" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landing_features_pkey" PRIMARY KEY ("id")
);

-- Seeded with exactly the copy the page ships with today, so the very first
-- render after this migration is byte-identical to the one before it and the
-- admin edits real text rather than an empty form.
INSERT INTO "site_content" ("key", "valueAr", "updatedAt") VALUES
  ('hero.badge',        'طريقك للوصول لنسبة 100%', NOW()),
  ('hero.headline',     'كل يوم وثبة. وثبة واحدة في النهاية.', NOW()),
  ('hero.sub',          'خمسة أسئلة يومية، ثماني دقائق، وتقرير أسبوعي يوضح لولي الأمر أين وصل ابنه. لا حشو، لا ضغط — تدريب يومي يبني نتيجة حقيقية.', NOW()),
  ('hero.ctaPrimary',   'ابدأ الوثبة الآن', NOW()),
  ('hero.ctaSecondary', 'عرض الأسعار', NOW()),
  ('features.heading',  'مصمم لثلاث جهات', NOW()),
  ('features.sub',      'الطالب يتدرب، ولي الأمر يتابع، المدرسة تراقب الفصل بأكمله.', NOW()),
  ('groups.heading',    'اختبارات نغطّيها', NOW()),
  ('groups.sub',        'من اختبارات الثانوية إلى الشهادات المهنية — نبقى معك كلما تغيّر هدفك.', NOW()),
  ('pricing.heading',   'اشتراك بسيط، بلا التزامات معقّدة', NOW()),
  ('pricing.sub',       'إلغاء في أي وقت، ويمكنك الاشتراك في أكثر من باقة إذا كنت تستعد لأكثر من اختبار.', NOW()),
  ('footer.text',       '© 2026 وثب. كل يوم وثبة.', NOW());

INSERT INTO "landing_features" ("id", "titleAr", "bodyAr", "sort") VALUES
  (gen_random_uuid()::text, 'وثبة يومية بمؤقت',      'خمسة أسئلة، مؤقّتة حسب التصنيف، وشرح فوري لكل إجابة خاطئة.', 0),
  (gen_random_uuid()::text, 'تقرير الوثبة الأسبوعي', 'تقرير واضح لولي الأمر: نقاط القوة، مناطق التعثّر، والاتساق أسبوعياً.', 1),
  (gen_random_uuid()::text, 'لوحة صف للمدرسة',       'متابعة الالتزام والدقة لكل طالب في الصف، بترتيب واضح لمن يحتاج دعماً.', 2),
  (gen_random_uuid()::text, 'سلسلة الوثبات',         'التزام يومي بسيط يبني عادة، بدل جلسة مذاكرة مكثّفة قبل الاختبار.', 3),
  (gen_random_uuid()::text, 'بنك أسئلة مصنّف',       'كل اختبار بشجرة تصنيف خاصة به، يفعّل الطالب ما يحتاجه فقط.', 4),
  (gen_random_uuid()::text, 'تحليل أداء دقيق',       'مقارنة وقتك ودقتك بمتوسط الطلاب على كل سؤال، لا مجرد نتيجة نهائية.', 5);
