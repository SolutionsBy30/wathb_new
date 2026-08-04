import { useEffect, useState } from 'react';
import { api, mediaUrl } from '../api/client';
import { Button } from '../design-system/components/Button';
import { QuestionCard } from '../design-system/components/QuestionCard';

const fieldStyle = { padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px', width: '100%', boxSizing: 'border-box' };
const labelStyle = { fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' };

/**
 * ADM-032 — attach artwork to a stem or an option. Some items can't be
 * expressed as text at all (a chart to read off, a geometry figure, a shape
 * sequence), so the picture *is* the question. Always optional.
 */
function ImageField({ value, onChange, label, compact = false }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.uploadQuestionImage(file);
      onChange(url);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {label && <label style={labelStyle}>{label}</label>}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        <label
          style={{
            cursor: busy ? 'default' : 'pointer', padding: '6px 12px', borderRadius: '999px',
            boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: 'var(--mist)',
            fontFamily: 'var(--font-arabic)', fontSize: '12px', whiteSpace: 'nowrap',
          }}
        >
          {busy ? 'جاري الرفع…' : value ? 'استبدال الصورة' : '+ صورة'}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            disabled={busy}
            onChange={(e) => { upload(e.target.files?.[0]); e.target.value = ''; }}
            style={{ display: 'none' }}
          />
        </label>
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            style={{ border: 'none', background: 'transparent', color: 'var(--coral)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '12px' }}
          >
            إزالة
          </button>
        )}
      </div>
      {value && (
        <img
          src={mediaUrl(value)}
          alt=""
          style={{ maxWidth: compact ? '120px' : '100%', maxHeight: compact ? '80px' : '220px', borderRadius: 'var(--radius-sm)', background: 'var(--sand)' }}
        />
      )}
      {error && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '11px', color: 'var(--coral)' }}>{error}</span>}
    </div>
  );
}

async function flattenLabels(tests) {
  const trees = await Promise.all(tests.map((t) => api.tree(t.id)));
  const out = [];
  for (const tree of trees) {
    for (const section of tree.sections) {
      for (const area of section.areas) {
        for (const l of area.labels) {
          out.push({ id: l.id, name: `${tree.nameAr} · ${section.nameAr} · ${area.nameAr} · ${l.nameAr}`, defaultTimeLimitS: l.defaultTimeLimitS });
        }
      }
    }
  }
  return out;
}

export default function QuestionEditor({ tests, questionId, onDone }) {
  const isNew = questionId === null;
  const [labels, setLabels] = useState([]);
  const [labelId, setLabelId] = useState('');
  const [difficulty, setDifficulty] = useState(3);
  const [timeLimitS, setTimeLimitS] = useState('');
  const [stem, setStem] = useState('');
  const [stemImageUrl, setStemImageUrl] = useState(null);
  const [options, setOptions] = useState([{ key: 'أ', text: '' }, { key: 'ب', text: '' }, { key: 'ج', text: '' }, { key: 'د', text: '' }]);
  const [correctKey, setCorrectKey] = useState('أ');
  const [explanation, setExplanation] = useState('');
  const [source, setSource] = useState('');
  const [status, setStatusField] = useState(null);
  const [dup, setDup] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { flattenLabels(tests).then(setLabels); }, [tests]);

  useEffect(() => {
    if (!isNew && questionId) {
      api.getQuestion(questionId).then((q) => {
        const v = q.versions[0];
        setLabelId(q.labelId);
        setDifficulty(q.difficulty);
        setTimeLimitS(q.timeLimitS ?? '');
        setStem(v.stem);
        setStemImageUrl(v.stemImageUrl ?? null);
        setOptions(v.options);
        setCorrectKey(v.correctKey);
        setExplanation(v.explanation);
        setSource(q.source ?? '');
        setStatusField(q.status);
      });
    }
  }, [isNew, questionId]);

  const checkDuplicate = async () => {
    if (!stem.trim()) return;
    try {
      const res = await api.findSimilar(stem.trim());
      setDup(res.exactDuplicateQuestionId || res.fuzzyMatches.length > 0 ? res : null);
    } catch { /* non-fatal */ }
  };

  const STATUS_LABEL = { draft: 'مسودة', in_review: 'قيد المراجعة', published: 'منشور', retired: 'متقاعد' };

  const submitForReview = async () => {
    setError(null);
    setBusy(true);
    try {
      await api.setStatus(questionId, 'in_review');
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setError(null);
    if (!labelId) return setError('اختر التصنيف.');
    if (!stem.trim()) return setError('نص السؤال مطلوب.');
    // An option may be a picture instead of text (shape/graph choices), so
    // it only has to carry one of the two.
    if (options.some((o) => !o.text.trim() && !o.imageUrl)) return setError('كل خيار يحتاج نصاً أو صورة.');
    if (!explanation.trim()) return setError('الشرح إلزامي — هذه هي لحظة التعلّم في المنتج.');
    setBusy(true);
    try {
      const dto = {
        labelId, difficulty: Number(difficulty), timeLimitS: timeLimitS ? Number(timeLimitS) : undefined,
        stem: stem.trim(),
        stemImageUrl: stemImageUrl || undefined,
        options: options.map((o) => ({ key: o.key, text: o.text, imageUrl: o.imageUrl || undefined })),
        correctKey, explanation: explanation.trim(), source: source.trim() || undefined,
      };
      if (isNew) await api.createQuestion(dto);
      else await api.newVersion(questionId, dto);
      onDone();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>
            {isNew ? 'سؤال جديد' : 'تعديل السؤال (نسخة جديدة)'}
          </h1>
          {status && <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>· {STATUS_LABEL[status]}</span>}
        </div>
        <button onClick={onDone} style={{ border: 'none', background: 'transparent', color: 'var(--mist)', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>→ رجوع للبنك</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '28px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <label style={labelStyle}>التصنيف</label>
          <select value={labelId} onChange={(e) => setLabelId(e.target.value)} style={fieldStyle}>
            <option value="">— اختر —</option>
            {labels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>

          <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>الصعوبة (1-5)</label>
              <input type="number" min={1} max={5} value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={fieldStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>مهلة الوقت (ث) — اختياري</label>
              <input type="number" value={timeLimitS} onChange={(e) => setTimeLimitS(e.target.value)} style={fieldStyle} placeholder="الافتراضي من التصنيف" />
            </div>
          </div>

          <label style={labelStyle}>نص السؤال</label>
          <textarea rows={3} value={stem} onChange={(e) => setStem(e.target.value)} onBlur={checkDuplicate} style={{ ...fieldStyle, resize: 'vertical' }} />
          {dup && (
            <div style={{ background: 'var(--coral)', color: 'var(--indigo)', borderRadius: 'var(--radius-sm)', padding: '10px', fontSize: '12px', fontFamily: 'var(--font-arabic)' }}>
              ⚠ يشبه سؤالاً موجوداً {dup.exactDuplicateQuestionId ? '(تطابق تام)' : `(تشابه ${Math.round((dup.fuzzyMatches[0]?.sim ?? 0) * 100)}%)`} — راجع قبل الحفظ.
            </div>
          )}

          <ImageField
            label="صورة السؤال (اختياري — رسم بياني أو شكل هندسي)"
            value={stemImageUrl}
            onChange={setStemImageUrl}
          />

          <label style={labelStyle}>الخيارات (حدد الإجابة الصحيحة)</label>
          {options.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <input
                type="radio"
                checked={correctKey === o.key}
                onChange={() => setCorrectKey(o.key)}
                title="الإجابة الصحيحة"
                style={{ marginTop: '12px' }}
              />
              <input
                value={o.key}
                onChange={(e) => setOptions((os) => os.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                style={{ ...fieldStyle, width: '48px', flex: 'none', textAlign: 'center' }}
              />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <input
                  value={o.text}
                  onChange={(e) => setOptions((os) => os.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                  style={fieldStyle}
                  placeholder={`خيار ${i + 1}`}
                />
                <ImageField
                  compact
                  value={o.imageUrl ?? null}
                  onChange={(url) => setOptions((os) => os.map((x, j) => j === i ? { ...x, imageUrl: url ?? undefined } : x))}
                />
              </div>
            </div>
          ))}

          <label style={labelStyle}>الشرح (إلزامي)</label>
          <textarea rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} style={{ ...fieldStyle, resize: 'vertical' }} />

          <label style={labelStyle}>المصدر</label>
          <input value={source} onChange={(e) => setSource(e.target.value)} style={fieldStyle} />

          {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="primary" disabled={busy} onClick={save}>{busy ? 'جاري الحفظ…' : 'حفظ'}</Button>
            {!isNew && status === 'draft' && (
              <button
                disabled={busy}
                onClick={submitForReview}
                style={{ border: 'none', cursor: 'pointer', padding: '10px 16px', borderRadius: '999px', background: 'transparent', boxShadow: 'inset 0 0 0 0.5px var(--on-indigo-line)', color: 'var(--lime)', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}
              >
                إرسال للمراجعة
              </button>
            )}
          </div>
        </div>

        <div dir="rtl" style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-lg)', padding: '24px', maxWidth: '420px', position: 'sticky', top: '20px' }}>
          <p style={{ ...labelStyle, marginBottom: '12px' }}>معاينة — بعين الطالب</p>
          <QuestionCard
            question={stem || 'نص السؤال يظهر هنا…'}
            questionImage={mediaUrl(stemImageUrl)}
            options={options.map((o) => o.text || (o.imageUrl ? '' : '—'))}
            optionImages={options.map((o) => mediaUrl(o.imageUrl))}
            selected={null}
            onSelect={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
