import { useEffect, useState } from 'react';
import { Button } from '../../design-system/components/Button';
import markOnIndigo from '../../design-system/assets/mark-on-indigo.svg';
import leapTrail from '../../design-system/assets/leap-trail-rtl-on-indigo.svg';
import { api } from '../../api/client';

const SUPERVISOR_APP_URL = import.meta.env.VITE_SUPERVISOR_APP_URL || 'http://localhost:5174/supervisor/';
const ADMIN_APP_URL = import.meta.env.VITE_ADMIN_APP_URL || 'http://localhost:5175/admin/';

const FEATURES = [
  { title: 'وثبة يومية بمؤقت', body: 'خمسة أسئلة، مؤقّتة حسب التصنيف، وشرح فوري لكل إجابة خاطئة.' },
  { title: 'تقرير الوثبة الأسبوعي', body: 'تقرير واضح لولي الأمر: نقاط القوة، مناطق التعثّر، والاتساق أسبوعياً.' },
  { title: 'لوحة صف للمدرسة', body: 'متابعة الالتزام والدقة لكل طالب في الصف، بترتيب واضح لمن يحتاج دعماً.' },
  { title: 'سلسلة الوثبات', body: 'التزام يومي بسيط يبني عادة، بدل جلسة مذاكرة مكثّفة قبل الاختبار.' },
  { title: 'قدرات وتحصيلي معاً', body: 'بنك أسئلة مصنّف لكلا الاختبارين، يفعّل الطالب ما يحتاجه فقط.' },
  { title: 'تحليل أداء دقيق', body: 'مقارنة وقتك ودقتك بمتوسط الطلاب على كل سؤال، لا مجرد نتيجة نهائية.' },
];

function formatSar(halalas) {
  return (halalas / 100).toLocaleString('ar-SA', { maximumFractionDigits: 0 });
}

function durationLabel(months) {
  if (months === 12) return '12 شهراً';
  if (months === 1) return 'شهر واحد';
  return `${months} أشهر`;
}

export default function Landing({ onGoLogin, onGoSignup }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [packages, setPackages] = useState([]);

  useEffect(() => {
    api.listPackages().then(setPackages).catch(() => {});
  }, []);

  const highlightIndex = Math.floor(packages.length / 2);

  return (
    <div dir="rtl" style={{ display: 'flex', flexDirection: 'column', background: 'var(--sand-deep)', fontFamily: 'var(--font-arabic)', minHeight: '100vh' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 48px', background: 'var(--indigo)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img src={markOnIndigo} alt="وثب" style={{ width: '34px', height: '32px' }} />
          <span style={{ fontFamily: 'var(--font-arabic)', fontWeight: 600, fontSize: '18px', color: 'var(--sand)' }}>وثب</span>
        </div>
        <nav style={{ display: 'flex', gap: '28px' }}>
          <a href="#features" style={{ color: 'var(--sand)', fontSize: '14px', textDecoration: 'none' }}>المميزات</a>
          <a href="#pricing" style={{ color: 'var(--sand)', fontSize: '14px', textDecoration: 'none' }}>الأسعار</a>
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
              <a href={ADMIN_APP_URL} style={menuItemStyle}>دخول الإدارة</a>
            </div>
          )}
        </div>
      </header>

      <section style={{ position: 'relative', background: 'var(--indigo)', padding: '88px 48px 96px', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${leapTrail})`, backgroundSize: '120px 140px', opacity: 0.16 }} />
        <div style={{ position: 'relative', maxWidth: '640px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--lime-print)', background: 'var(--on-indigo-subtle)', padding: '6px 16px', borderRadius: '999px' }}>
            طريقك للوصول لنسبة 100%
          </span>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '40px', fontWeight: 600, color: 'var(--sand)', lineHeight: 1.5 }}>
            كل يوم وثبة. وثبة واحدة في النهاية.
          </h1>
          <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '16px', color: 'var(--mist)', lineHeight: 1.9, maxWidth: '480px' }}>
            خمسة أسئلة يومية، ثماني دقائق، وتقرير أسبوعي يوضح لولي الأمر أين وصل ابنه. لا حشو، لا ضغط — تدريب يومي يبني نتيجة حقيقية.
          </p>
          <div style={{ display: 'flex', gap: '14px', marginTop: '8px' }}>
            <Button variant="primary" onClick={onGoSignup}>ابدأ الوثبة الآن</Button>
            <a href="#pricing" style={{ background: 'var(--on-indigo-subtle)', color: 'var(--sand)', padding: '14px 28px', borderRadius: '999px', fontSize: '14px', fontWeight: 500, textDecoration: 'none' }}>
              عرض الأسعار
            </a>
          </div>
        </div>
      </section>

      <section id="features" style={{ padding: '80px 48px', maxWidth: '1080px', margin: '0 auto', width: '100%' }}>
        <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-arabic)', fontSize: '26px', fontWeight: 600, color: 'var(--indigo)', textAlign: 'center' }}>
          مصمم لثلاث جهات
        </h2>
        <p style={{ margin: '0 0 48px', fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--mist)', textAlign: 'center' }}>
          الطالب يتدرب، ولي الأمر يتابع، المدرسة تراقب الفصل بأكمله.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{ background: 'var(--paper)', borderRadius: 'var(--radius-lg)', boxShadow: 'inset 0 0 0 0.5px var(--on-sand-line)', padding: '28px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '16px', fontWeight: 500, color: 'var(--indigo)' }}>{f.title}</span>
              <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--graphite)', lineHeight: 1.8 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" style={{ padding: '80px 48px', background: 'var(--indigo)' }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
          <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--font-arabic)', fontSize: '26px', fontWeight: 600, color: 'var(--sand)', textAlign: 'center' }}>
            اشتراك بسيط، بلا التزامات معقّدة
          </h2>
          <p style={{ margin: '0 0 48px', fontFamily: 'var(--font-arabic)', fontSize: '14px', color: 'var(--mist)', textAlign: 'center' }}>
            إلغاء في أي وقت. كل الباقات تشمل قدرات وتحصيلي.
          </p>
          {packages.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--mist)', fontSize: '13px' }}>الباقات غير متاحة حالياً.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(packages.length, 3)}, 1fr)`, gap: '20px' }}>
              {packages.map((p, i) => {
                const highlighted = i === highlightIndex;
                return (
                  <div
                    key={p.id}
                    style={{
                      background: highlighted ? 'var(--lime)' : 'var(--on-indigo-subtle)',
                      borderRadius: 'var(--radius-lg)', padding: '28px', display: 'flex', flexDirection: 'column', gap: '10px',
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '14px', color: highlighted ? 'var(--lime-ink)' : 'var(--mist)' }}>{p.nameAr}</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                      <span style={{ fontFamily: 'var(--font-latin)', fontSize: '36px', fontWeight: 500, color: highlighted ? 'var(--lime-ink)' : 'var(--sand)' }}>
                        {formatSar(p.priceHalalas)}
                      </span>
                      <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: highlighted ? 'var(--lime-ink)' : 'var(--mist)' }}>ريال</span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: highlighted ? 'var(--lime-ink)' : 'var(--mist)' }}>{durationLabel(p.durationMonths)}</span>
                    <button
                      onClick={onGoSignup}
                      style={{
                        marginTop: '8px', textAlign: 'center', padding: '12px', borderRadius: '999px', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer',
                        background: highlighted ? 'var(--lime-ink)' : 'var(--lime)',
                        color: highlighted ? 'var(--lime)' : 'var(--lime-ink)',
                        fontFamily: 'var(--font-arabic)',
                      }}
                    >
                      اشترك الآن
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <footer style={{ padding: '32px 48px', textAlign: 'center' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>© 2026 وثب. كل يوم وثبة.</span>
      </footer>
    </div>
  );
}

const menuItemStyle = {
  padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '13px', color: 'var(--indigo)',
  textDecoration: 'none', border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'start', fontFamily: 'var(--font-arabic)',
};
