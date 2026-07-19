import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';
import { QuestionCard } from '../design-system/components/QuestionCard';

const fieldStyle = { padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px', width: '100%', boxSizing: 'border-box' };
const labelStyle = { fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' };

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
  const [options, setOptions] = useState([{ key: 'أ', text: '' }, { key: 'ب', text: '' }, { key: 'ج', text: '' }, { key: 'د', text: '' }]);
  const [correctKey, setCorrectKey] = useState('أ');
  const [explanation, setExplanation] = useState('');
  const [source, setSource] = useState('');
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
        setOptions(v.options);
        setCorrectKey(v.correctKey);
        setExplanation(v.explanation);
        setSource(q.source ?? '');
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

  const save = async () => {
    setError(null);
    if (!labelId) return setError('اختر التصنيف.');
    if (!stem.trim()) return setError('نص السؤال مطلوب.');
    if (options.some((o) => !o.text.trim())) return setError('جميع الخيارات مطلوبة.');
    if (!explanation.trim()) return setError('الشرح إلزامي — هذه هي لحظة التعلّم في المنتج.');
    setBusy(true);
    try {
      const dto = {
        labelId, difficulty: Number(difficulty), timeLimitS: timeLimitS ? Number(timeLimitS) : undefined,
        stem: stem.trim(), options, correctKey, explanation: explanation.trim(), source: source.trim() || undefined,
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
        <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>
          {isNew ? 'سؤال جديد' : 'تعديل السؤال (نسخة جديدة)'}
        </h1>
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

          <label style={labelStyle}>الخيارات (حدد الإجابة الصحيحة)</label>
          {options.map((o, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="radio"
                checked={correctKey === o.key}
                onChange={() => setCorrectKey(o.key)}
                title="الإجابة الصحيحة"
              />
              <input
                value={o.key}
                onChange={(e) => setOptions((os) => os.map((x, j) => j === i ? { ...x, key: e.target.value } : x))}
                style={{ ...fieldStyle, width: '48px', flex: 'none', textAlign: 'center' }}
              />
              <input
                value={o.text}
                onChange={(e) => setOptions((os) => os.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                style={fieldStyle}
                placeholder={`خيار ${i + 1}`}
              />
            </div>
          ))}

          <label style={labelStyle}>الشرح (إلزامي)</label>
          <textarea rows={3} value={explanation} onChange={(e) => setExplanation(e.target.value)} style={{ ...fieldStyle, resize: 'vertical' }} />

          <label style={labelStyle}>المصدر</label>
          <input value={source} onChange={(e) => setSource(e.target.value)} style={fieldStyle} />

          {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>}
          <Button variant="primary" disabled={busy} onClick={save}>{busy ? 'جاري الحفظ…' : 'حفظ'}</Button>
        </div>

        <div dir="rtl" style={{ background: 'var(--indigo)', borderRadius: 'var(--radius-lg)', padding: '24px', maxWidth: '420px', position: 'sticky', top: '20px' }}>
          <p style={{ ...labelStyle, marginBottom: '12px' }}>معاينة — بعين الطالب</p>
          <QuestionCard question={stem || 'نص السؤال يظهر هنا…'} options={options.map((o) => o.text || '—')} selected={null} onSelect={() => {}} />
        </div>
      </div>
    </div>
  );
}
