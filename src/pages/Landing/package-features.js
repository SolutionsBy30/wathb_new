/**
 * PAY-012 — what a package actually gives you, read off the package.
 *
 * Every line here is derived from a field the admin already sets, never from
 * marketing copy kept in sync by hand. A package whose `weeklyReportEnabled`
 * is switched off stops advertising the weekly report the moment it is saved,
 * which is the only way a pricing page stays honest as the tiers change.
 *
 * Two rules the wording follows:
 *
 *  - Say what is included, and say what is *not* only where its absence is the
 *    thing a buyer would otherwise assume. "لا يشمل المحاكي" earns its place
 *    because every competitor bundles mock exams; "no email notifications"
 *    does not, because nobody expects them.
 *
 *  - Never describe a limit as a feature. `dailyWathbLimit: 1` reads as
 *    "وثبة واحدة في اليوم", not "وثبة يومية مضمونة".
 */

/** A package covers a test only if it lists it — an empty list covers nothing. */
export function coversTest(pkg, testId) {
  return Array.isArray(pkg.testIds) && pkg.testIds.includes(testId);
}

/** Test names for the ids a package lists, in catalogue order. */
export function coveredTestNames(pkg, tests) {
  if (!Array.isArray(pkg.testIds)) return [];
  return tests.filter((t) => pkg.testIds.includes(t.id)).map((t) => t.nameAr);
}

export function packageFeatures(pkg, tests = []) {
  const features = [];

  const names = coveredTestNames(pkg, tests);
  if (names.length === 1) features.push({ included: true, text: `اختبار ${names[0]}` });
  else if (names.length > 1) features.push({ included: true, text: names.join(' و') });
  else if (Array.isArray(pkg.testIds) && pkg.testIds.length === 0) {
    // A package covering nothing is a configuration mistake, not a tier. Say
    // so plainly rather than rendering a card that looks complete.
    features.push({ included: false, text: 'لا يشمل أي اختبار بعد' });
  }

  if (pkg.questionsPerDay) {
    features.push({ included: true, text: `${pkg.questionsPerDay} أسئلة في كل وثبة` });
  }

  // null means unlimited — the paid default. Only a real cap is worth a line,
  // and it is stated as the cap it is.
  if (pkg.dailyWathbLimit === 1) {
    features.push({ included: true, text: 'وثبة واحدة في اليوم' });
  } else if (typeof pkg.dailyWathbLimit === 'number' && pkg.dailyWathbLimit > 1) {
    features.push({ included: true, text: `حتى ${pkg.dailyWathbLimit} وثبات في اليوم` });
  } else if (pkg.dailyWathbLimit == null) {
    features.push({ included: true, text: 'وثبات غير محدودة يومياً' });
  }

  // §5.5 — zero is the safe default, and its absence is exactly what a buyer
  // comparing tiers needs to see.
  if (pkg.simulationsIncluded > 0) {
    features.push({
      included: true,
      text: pkg.simulationsIncluded === 1
        ? 'محاكاة اختبار كاملة واحدة'
        : `${pkg.simulationsIncluded} محاكاة اختبار كاملة`,
    });
  } else {
    features.push({ included: false, text: 'لا يشمل المحاكي' });
  }

  features.push(
    pkg.weeklyReportEnabled
      ? { included: true, text: 'تقرير أسبوعي لولي الأمر' }
      : { included: false, text: 'بدون التقرير الأسبوعي' },
  );

  features.push(
    pkg.supervisorLinkingAllowed
      ? { included: true, text: 'ربط ولي أمر أو معلم' }
      : { included: false, text: 'بدون ربط ولي الأمر' },
  );

  // FRE-004 — 'partial' is a real product difference, not a technicality: the
  // student sees bands instead of per-area detail.
  features.push(
    pkg.reportVisibility === 'partial'
      ? { included: false, text: 'تقرير أداء مختصر' }
      : { included: true, text: 'تقرير أداء مفصّل بكل مجال' },
  );

  return features;
}
