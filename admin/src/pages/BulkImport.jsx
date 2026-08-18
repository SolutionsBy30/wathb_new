import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

// ADM-032 — the *_image columns are optional and hold a URL, not a file: a
// CSV can't carry bytes. Upload artwork in the single-question editor (or
// host it yourself) and paste the resulting URL here.
const TEMPLATE_HEADER = 'type,difficulty,time_limit_s,stem,stem_image_url,option_1,option_1_image,option_2,option_2_image,option_3,option_3_image,option_4,option_4_image,option_5,option_5_image,correct_option,explanation,source\n';
const TEMPLATE_EXAMPLE = 'mcq_single,3,40,"نص السؤال هنا",,"خيار 1",,"خيار 2",,"خيار 3",,"خيار 4",,,,2,"شرح الإجابة الصحيحة هنا",استيراد يدوي\n';

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_HEADER + TEMPLATE_EXAMPLE], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wathb-question-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

const selectStyle = { padding: '9px 12px', borderRadius: 'var(--radius-sm)', border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '13px', minWidth: '160px' };

// ADM-030 — destination-first: Test → Section → Area → Label chosen here,
// before any file touches the server. Every question in the uploaded file
// lands in whichever label is selected at the end of this chain.
function DestinationPicker({ tests, onSelect }) {
  const [testId, setTestId] = useState('');
  const [tree, setTree] = useState(null);
  const [sectionId, setSectionId] = useState('');
  const [areaId, setAreaId] = useState('');
  const [labelId, setLabelId] = useState('');

  useEffect(() => {
    setSectionId(''); setAreaId(''); setLabelId(''); setTree(null);
    if (testId) api.tree(testId).then(setTree);
  }, [testId]);

  useEffect(() => { setAreaId(''); setLabelId(''); }, [sectionId]);
  useEffect(() => { setLabelId(''); }, [areaId]);

  useEffect(() => {
    if (labelId) onSelect(labelId);
    else onSelect(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelId]);

  const section = tree?.sections.find((s) => s.id === sectionId);
  const area = section?.areas.find((a) => a.id === areaId);

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      <select value={testId} onChange={(e) => setTestId(e.target.value)} style={selectStyle}>
        <option value="">اختر الاختبار</option>
        {tests.map((t) => <option key={t.id} value={t.id}>{t.nameAr}</option>)}
      </select>
      <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!tree} style={selectStyle}>
        <option value="">اختر القسم</option>
        {tree?.sections.map((s) => <option key={s.id} value={s.id}>{s.nameAr}</option>)}
      </select>
      <select value={areaId} onChange={(e) => setAreaId(e.target.value)} disabled={!section} style={selectStyle}>
        <option value="">اختر المجال</option>
        {section?.areas.map((a) => <option key={a.id} value={a.id}>{a.nameAr}</option>)}
      </select>
      <select value={labelId} onChange={(e) => setLabelId(e.target.value)} disabled={!area} style={selectStyle}>
        <option value="">اختر التصنيف</option>
        {area?.labels.filter((l) => !l.isRetired).map((l) => <option key={l.id} value={l.id}>{l.nameAr}</option>)}
      </select>
    </div>
  );
}

export default function BulkImport({ tests }) {
  const fileRef = useRef(null);
  const [destinationLabelId, setDestinationLabelId] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const onFile = async (e) => {
    const file = e.target.files[0];
    if (!file || !destinationLabelId) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      setReport(await api.importCsv(file, destinationLabelId));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const patchRow = async (rowIndex, field, value) => {
    const updated = await api.patchImportRow(report.jobId, rowIndex, { [field]: value });
    setReport(updated);
  };

  const commit = async (skipInvalid = false) => {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.commitImport(report.jobId, skipInvalid));
      setReport(null);
    } catch (e) {
      setError(e.message);
      // The server returns the up-to-date report on rejection — re-render it so the admin can fix in-grid.
      try {
        const parsed = JSON.parse(e.message);
        if (parsed.report) setReport(parsed.report);
      } catch { /* message wasn't a JSON validation payload */ }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <h1 style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '20px', fontWeight: 500, color: 'var(--sand)' }}>استيراد جماعي</h1>
      <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--mist)' }}>
        اختر الوجهة → ارفع → تحقق → تأكيد. كل سؤال في الملف يُستورد إلى الوجهة المختارة أدناه. إذا وُجدت صفوف بها أخطاء (مثل سؤال مكرر) يمكنك تصحيحها هنا، أو استيراد الصفوف الصحيحة فقط وتجاهل الباقي.
      </p>

      <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>1. اختر الوجهة (الاختبار ← القسم ← المجال ← التصنيف)</span>
        <DestinationPicker tests={tests} onSelect={setDestinationLabelId} />
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button onClick={downloadTemplate} style={{ border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', borderRadius: 'var(--radius-sm)', padding: '9px 14px', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>
          تنزيل القالب
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={onFile}
          disabled={!destinationLabelId}
          style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: destinationLabelId ? 'var(--sand)' : 'var(--mist)' }}
        />
        {!destinationLabelId && (
          <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>أكمل اختيار الوجهة أولاً</span>
        )}
      </div>

      {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>}
      {/* ADM-094 — a partial import must say what it left behind, by row
          number and reason. Reporting only "created N" on a file of 200 would
          leave the author to work out which rows never landed. */}
      {result && (
        <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--teal)' }}>
            تم استيراد {result.created} سؤالاً بنجاح.
          </p>
          {result.skipped > 0 && (
            <>
              <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--coral)' }}>
                وتم تجاهل {result.skipped} صفاً:
              </p>
              <ul style={{ margin: 0, paddingInlineStart: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {result.skippedRows?.map((r) => (
                  <li key={r.row} style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)', lineHeight: 1.8 }}>
                    صف {r.row}: {r.stem || '—'} <span style={{ color: 'var(--coral)' }}>({r.errors.join('، ')})</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', gap: '18px', alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }}>
              الوجهة: {report.destination?.testNameAr} ← {report.destination?.sectionNameAr} ← {report.destination?.areaNameAr} ← {report.destination?.labelNameAr}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '18px', fontFamily: 'var(--font-latin)', fontSize: '13px', color: 'var(--mist)' }}>
            <span>الإجمالي: {report.totalRows}</span>
            <span style={{ color: 'var(--teal-ink)' }}>صالح: {report.validRows}</span>
            <span style={{ color: 'var(--coral)' }}>أخطاء: {report.errorRows}</span>
          </div>

          <div style={{ background: 'var(--on-indigo-subtle)', borderRadius: 'var(--radius-md)', overflow: 'auto', maxHeight: '520px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ textAlign: 'start', fontFamily: 'var(--font-arabic)', color: 'var(--mist)' }}>
                  <th style={th}>#</th>
                  <th style={th}>الصعوبة</th>
                  <th style={th}>نص السؤال</th>
                  <th style={th}>الشرح</th>
                  <th style={th}>الأخطاء</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.rowIndex} style={{ borderTop: '0.5px solid var(--on-indigo-line)', background: row.errors.length ? 'rgba(255,107,107,0.08)' : 'transparent' }}>
                    <td style={td}>{row.rowIndex + 1}</td>
                    <td style={td}>
                      <input type="number" defaultValue={row.difficulty} onBlur={(e) => patchRow(row.rowIndex, 'difficulty', Number(e.target.value))} style={{ ...cellInput, width: '48px' }} />
                    </td>
                    <td style={{ ...td, minWidth: '220px' }}>
                      <textarea defaultValue={row.stem} onBlur={(e) => patchRow(row.rowIndex, 'stem', e.target.value)} style={{ ...cellInput, width: '100%' }} rows={2} />
                    </td>
                    <td style={{ ...td, minWidth: '220px' }}>
                      <textarea defaultValue={row.explanation} onBlur={(e) => patchRow(row.rowIndex, 'explanation', e.target.value)} style={{ ...cellInput, width: '100%' }} rows={2} />
                    </td>
                    <td style={{ ...td, color: 'var(--coral)', fontFamily: 'var(--font-arabic)', maxWidth: '220px' }}>
                      {row.errors.join(' · ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ADM-094 — the strict commit stays the primary action when the
              file is clean. With errors present it would only ever fail, so
              it is replaced by the explicit partial import rather than left
              disabled with no way forward. A file with nothing valid in it
              offers neither. */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {report.errorRows === 0 ? (
              <Button variant="primary" disabled={busy || report.validRows === 0} onClick={() => commit(false)}>
                {busy ? 'جاري التأكيد…' : `تأكيد استيراد ${report.validRows} سؤال`}
              </Button>
            ) : (
              <>
                <Button variant="primary" disabled={busy || report.validRows === 0} onClick={() => commit(true)}>
                  {busy ? 'جاري التأكيد…' : `استيراد الصفوف الصحيحة فقط (${report.validRows})`}
                </Button>
                <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '12px', color: 'var(--mist)' }}>
                  {report.validRows === 0
                    ? 'لا يوجد أي صف صالح للاستيراد.'
                    : `سيتم تجاهل ${report.errorRows} صفاً بها أخطاء. صحّحها أعلاه إن أردت استيرادها.`}
                </span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const th = { padding: '8px 10px' };
const td = { padding: '6px 10px', verticalAlign: 'top' };
const cellInput = { padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '12px' };
