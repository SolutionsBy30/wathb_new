import { useEffect, useState } from 'react';
import { Button } from '../../design-system/components/Button';
import markOnIndigo from '../../design-system/assets/mark-on-indigo.svg';
import leapTrail from '../../design-system/assets/leap-trail-rtl-on-indigo.svg';
import { api } from '../../api/client';
import { coversTest, packageFeatures } from './package-features';

const SUPERVISOR_APP_URL = import.meta.env.VITE_SUPERVISOR_APP_URL || 'http://localhost:5174/supervisor/';
// The admin console is deliberately not linked from the public landing page —
// it's staff-only, and advertising its URL to every visitor adds nothing for
// students while widening the attack surface on the one login that isn't
// OTP-gated. Admins reach it directly at admin.<domain>.

function formatSar(halalas) {
  return (halalas / 100).toLocaleString('ar-SA', { maximumFractionDigits: 0 });
}

function durationLabel(months) {
  if (months === 12) return '12 شهراً';
  if (months === 1) return 'شهر واحد';
  return `${months} أشهر`;
}

const h2Style = { margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '26px', fontWeight: 600, color: 'var(--indigo)', textAlign: 'center' };
const subStyle = { margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--graphite)', textAlign: 'center', lineHeight: 1.9, maxWidth: '54ch' };

/** One package card — shared by every group section, so they cannot drift. */
function PackageCard({ pkg, tests, highlighted, onGoSignup }) {
  return (
    <div
      style={{
        background: highlighted ? 'var(--lime)' : 'var(--paper)',
        boxShadow: highlighted ? 'none' : 'inset 0 0 0 0.5px var(--on-sand-line)',
        borderRadius: 'var(--radius-lg)', padding: '26px', display: 'flex', flexDirection: 'column', gap: '10px',
      }}
    >
      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '14px', fontWeight: 500, color: highlighted ? 'var(--lime-ink)' : 'var(--indigo)' }}>
        {pkg.nameAr}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{ fontFamily: 'var(--font-latin)', fontSize: '34px', fontWeight: 500, color: highlighted ? 'var(--lime-ink)' : 'var(--indigo)' }}>
          {formatSar(pkg.priceHalalas)}
        </span>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: highlighted ? 'var(--lime-ink)' : 'var(--graphite)' }}>ريال</span>
      </div>
      {/* PAY-010 — the API only sends compareAtHalalas when it is a genuine
          saving, so no client-side rule here. */}
      {pkg.compareAtHalalas && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-latin)', fontSize: '15px', textDecoration: 'line-through', color: highlighted ? 'var(--lime-ink)' : 'var(--mist)', opacity: 0.75 }}>
            {formatSar(pkg.compareAtHalalas)}
          </span>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', borderRadius: '999px', padding: '2px 8px', background: highlighted ? 'var(--indigo)' : 'var(--lime-print)', color: highlighted ? 'var(--lime)' : 'var(--paper)' }}>
            خصم {pkg.discountPercent}%
          </span>
        </div>
      )}
      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: highlighted ? 'var(--lime-ink)' : 'var(--mist)' }}>
        {durationLabel(pkg.durationMonths)}
      </span>

      {/* PAY-012 — read off the package's own fields, so a tier that loses the
          weekly report stops advertising it the moment it is saved. */}
      <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '7px' }}>
        {packageFeatures(pkg, tests).map((f) => (
          <li
            key={f.text}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '8px',
              fontFamily: 'var(--font-arabic)', fontSize: '12px', lineHeight: 1.6,
              color: highlighted ? 'var(--lime-ink)' : f.included ? 'var(--graphite)' : 'var(--mist)',
              opacity: f.included ? 1 : 0.8,
            }}
          >
            <span aria-hidden style={{ flexShrink: 0, fontFamily: 'var(--font-latin)' }}>{f.included ? '✓' : '—'}</span>
            <span>{f.text}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onGoSignup}
        style={{
          marginTop: '12px', textAlign: 'center', padding: '12px', borderRadius: '999px', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer',
          background: highlighted ? 'var(--lime-ink)' : 'var(--indigo)',
          color: highlighted ? 'var(--lime)' : 'var(--sand)',
          fontFamily: 'var(--font-arabic)',
        }}
      >
        اشترك الآن
      </button>
    </div>
  );
}

/**
 * CMS-002 — one catalogue segment, with its own exams and the packages that
 * cover them.
 *
 * A section per group rather than one filtered list: a visitor arriving for a
 * professional certificate should not have to work out which of nine packages
 * applies to them, and a school leaver should not scroll past licensing exams
 * to find قدرات. Each section answers one audience completely.
 *
 * The heading and blurb are the group's own nameAr and descriptionAr, edited
 * on the taxonomy screen — so adding a segment to the catalogue adds a section
 * here with no deploy.
 */
function GroupSection({ group, packages, tests, onGoSignup, alt }) {
  const [testId, setTestId] = useState(null);

  const groupTestIds = group.items.map((t) => t.id);
  const covering = packages.filter((p) => groupTestIds.some((id) => coversTest(p, id)));
  const shown = testId ? covering.filter((p) => coversTest(p, testId)) : covering;
  const selected = group.items.find((t) => t.id === testId);
  const highlightIndex = Math.floor(shown.length / 2);

  return (
    <section
      id={`group-${group.id}`}
      style={{
        background: alt ? 'var(--sand-deep)' : 'var(--sand)',
        padding: '64px 24px',
      }}
    >
      <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
          <h2 style={h2Style}>{group.nameAr}</h2>
          {group.descriptionAr && <p style={subStyle}>{group.descriptionAr}</p>}
        </div>

        {/* The exams inside this segment. Selecting one narrows the packages
            below to those that actually cover it. */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {group.items.map((t) => {
            const on = testId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTestId(on ? null : t.id)}
                aria-pressed={on}
                style={{
                  border: 'none', cursor: 'pointer', padding: '9px 18px', borderRadius: '999px',
                  fontFamily: 'var(--font-arabic)', fontSize: '13px',
                  background: on ? 'var(--indigo)' : 'var(--paper)',
                  boxShadow: on ? 'none' : 'inset 0 0 0 0.5px var(--on-sand-line)',
                  color: on ? 'var(--sand)' : 'var(--indigo)',
                }}
              >
                {t.nameAr}
              </button>
            );
          })}
        </div>

        {selected && (
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--graphite)' }}>
            الباقات التي تشمل {selected.nameAr}
            {' · '}
            <button
              onClick={() => setTestId(null)}
              style={{ border: 'none', background: 'transparent', color: 'var(--lime-print)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '12px', padding: 0, textDecoration: 'underline' }}
            >
              كل باقات هذه المجموعة
            </button>
          </span>
        )}

        {shown.length === 0 ? (
          // A real answer rather than an empty grid.
          <p style={{ ...subStyle, color: 'var(--mist)' }}>
            {selected
              ? `لا توجد باقة تشمل ${selected.nameAr} حالياً.`
              : 'الباقات لهذه المجموعة قيد الإعداد.'}
          </p>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(auto-fit, minmax(240px, ${shown.length > 2 ? '1fr' : '320px'}))`,
              gap: '18px', width: '100%', justifyContent: 'center',
            }}
          >
            {shown.map((p, i) => (
              <PackageCard key={p.id} pkg={p} tests={tests} highlighted={shown.length > 1 && i === highlightIndex} onGoSignup={onGoSignup} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function Landing({ onGoLogin, onGoSignup }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [packages, setPackages] = useState([]);
  const [tests, setTests] = useState([]);
  const [groups, setGroups] = useState([]);
  // CMS-001 — every string below comes from the API, with the shipped copy as
  // the fallback, so the page renders fully before content loads and survives
  // the endpoint being unreachable.
  const [content, setContent] = useState(null);

  useEffect(() => {
    api.listPackages().then(setPackages).catch(() => {});
    api.listTests().then(setTests).catch(() => setTests([]));
    api.listTestGroups().then(setGroups).catch(() => setGroups([]));
    api.siteContent().then(setContent).catch(() => setContent(null));
  }, []);

  const t = (key, fallback) => content?.text?.[key] ?? fallback;
  const features = content?.features ?? [];

  // CMS-002 — a section per segment that actually has exams. Ungrouped exams
  // get one trailing section rather than disappearing, since an unfiled exam
  // is a taxonomy gap and not a reason to hide a product.
  const segments = groups
    .map((g) => ({ ...g, items: tests.filter((x) => x.groupId === g.id) }))
    .filter((g) => g.items.length > 0);
  const ungrouped = tests.filter((x) => !x.groupId || !segments.some((g) => g.id === x.groupId));
  const sections = ungrouped.length
    ? [...segments, { id: '__other', nameAr: 'اختبارات أخرى', descriptionAr: null, items: ungrouped }]
    : segments;

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', background: 'var(--sand)', fontFamily: 'var(--font-arabic)', minHeight: '100vh' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '18px 24px', background: 'var(--indigo)', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={markOnIndigo} alt="وثب" style={{ width: '34px', height: '32px' }} />
          <span style={{ fontFamily: 'var(--font-arabic)', fontWeight: 600, fontSize: '18px', color: 'var(--sand)' }}>وثب</span>
        </div>
        <nav style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <a href="#features" style={{ color: 'var(--sand)', fontSize: '14px', textDecoration: 'none' }}>المميزات</a>
          <a href="#exams" style={{ color: 'var(--sand)', fontSize: '14px', textDecoration: 'none' }}>الاختبارات</a>
        </nav>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            style={{ background: 'var(--lime)', color: 'var(--lime-ink)', padding: '10px 20px', borderRadius: '999px', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-arabic)' }}
          >
            تسجيل الدخول
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', top: '48px', left: 0, background: 'var(--paper)', borderRadius: 'var(--radius-md)', boxShadow: 'inset 0 0 0 0.5px var(--on-sand-line)', padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '200px', zIndex: 10 }}>
              <button onClick={() => { setMenuOpen(false); onGoLogin(); }} style={menuItemStyle}>دخول / تسجيل الطالب</button>
              <a href={SUPERVISOR_APP_URL} style={menuItemStyle}>دخول ولي الأمر / المشرف</a>
            </div>
          )}
        </div>
      </header>

      <section style={{ position: 'relative', background: 'var(--indigo)', padding: '76px 24px 84px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${leapTrail})`, backgroundSize: '120px 140px', opacity: 0.16 }} />
        <div style={{ position: 'relative', maxWidth: '640px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--lime-print)', background: 'var(--on-indigo-subtle)', padding: '6px 16px', borderRadius: '999px' }}>
            {t('hero.badge', 'طريقك للوصول لنسبة 100%')}
          </span>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: 'clamp(28px, 6vw, 40px)', fontWeight: 600, color: 'var(--sand)', lineHeight: 1.45, textWrap: 'balance' }}>
            {t('hero.headline', 'كل يوم وثبة. وثبة واحدة في النهاية.')}
          </h1>
          <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '16px', color: 'var(--mist)', lineHeight: 1.9, maxWidth: '480px' }}>
            {t('hero.sub', 'خمسة أسئلة يومية، ثماني دقائق، وتقرير أسبوعي يوضح لولي الأمر أين وصل ابنه. لا حشو، لا ضغط — تدريب يومي يبني نتيجة حقيقية.')}
          </p>
          <div style={{ display: 'flex', gap: '14px', marginTop: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button variant="primary" onClick={onGoSignup}>{t('hero.ctaPrimary', 'ابدأ الوثبة الآن')}</Button>
            <a href="#exams" style={{ background: 'var(--on-indigo-subtle)', color: 'var(--sand)', padding: '14px 28px', borderRadius: '999px', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>
              {t('hero.ctaSecondary', 'عرض الأسعار')}
            </a>
          </div>
        </div>
      </section>

      <section id="features" style={{ padding: '72px 24px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center', marginBottom: '40px' }}>
          <h2 style={h2Style}>{t('features.heading', 'مصمم لثلاث جهات')}</h2>
          <p style={subStyle}>{t('features.sub', 'الطالب يتدرب، ولي الأمر يتابع، المدرسة تراقب الفصل بأكمله.')}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
          {features.map((f) => (
            <div key={f.id} style={{ background: 'var(--paper)', borderRadius: 'var(--radius-lg)', boxShadow: 'inset 0 0 0 0.5px var(--on-sand-line)', padding: '26px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '16px', fontWeight: 500, color: 'var(--indigo)' }}>{f.titleAr}</span>
              <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--graphite)', lineHeight: 1.8 }}>{f.bodyAr}</p>
            </div>
          ))}
        </div>
      </section>

      <div id="exams" style={{ background: 'var(--indigo)', padding: '56px 24px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
          <h2 style={{ ...h2Style, color: 'var(--sand)' }}>{t('groups.heading', 'اختبارات نغطّيها')}</h2>
          <p style={{ ...subStyle, color: 'var(--mist)' }}>{t('groups.sub', 'من اختبارات الثانوية إلى الشهادات المهنية — نبقى معك كلما تغيّر هدفك.')}</p>
          {sections.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '10px' }}>
              {sections.map((g) => (
                <a
                  key={g.id}
                  href={`#group-${g.id}`}
                  style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)', background: 'var(--on-indigo-subtle)', padding: '8px 16px', borderRadius: '999px', textDecoration: 'none' }}
                >
                  {g.nameAr}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {sections.length === 0 ? (
        <section style={{ padding: '64px 24px', textAlign: 'center' }}>
          <p style={{ ...subStyle, margin: '0 auto', color: 'var(--mist)' }}>الاختبارات قيد الإعداد.</p>
        </section>
      ) : (
        sections.map((g, i) => (
          <GroupSection key={g.id} group={g} packages={packages} tests={tests} onGoSignup={onGoSignup} alt={i % 2 === 1} />
        ))
      )}

      <section style={{ background: 'var(--paper)', padding: '56px 24px' }}>
        <div style={{ maxWidth: '620px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          <h2 style={h2Style}>{t('pricing.heading', 'اشتراك بسيط، بلا التزامات معقّدة')}</h2>
          <p style={subStyle}>
            {t('pricing.sub', 'إلغاء في أي وقت، ويمكنك الاشتراك في أكثر من باقة إذا كنت تستعد لأكثر من اختبار.')}
          </p>
          <div style={{ marginTop: '8px' }}>
            <Button variant="primary" onClick={onGoSignup}>{t('hero.ctaPrimary', 'ابدأ الوثبة الآن')}</Button>
          </div>
        </div>
      </section>

      <footer style={{ padding: '32px 24px', textAlign: 'center', background: 'var(--indigo)' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
          {t('footer.text', '© 2026 وثب. كل يوم وثبة.')}
        </span>
      </footer>
    </div>
  );
}

const menuItemStyle = {
  padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--indigo)',
  textDecoration: 'none', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'start', fontFamily: 'var(--font-arabic)',
};
