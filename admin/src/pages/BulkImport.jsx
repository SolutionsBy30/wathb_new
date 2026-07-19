import { useRef, useState } from 'react';
import { api } from '../api/client';
import { Button } from '../design-system/components/Button';

const TEMPLATE_HEADER = 'label_id,type,difficulty,time_limit_s,stem,option_1,option_2,option_3,option_4,option_5,correct_option,explanation,source\n';
const TEMPLATE_EXAMPLE = ',mcq_single,3,40,"نص السؤال هنا","خيار 1","خيار 2","خيار 3","خيار 4",,2,"شرح الإجابة الصحيحة هنا",استيراد يدوي\n';

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_HEADER + TEMPLATE_EXAMPLE], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'wathb-question-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function BulkImport() {
  const fileRef = useRef(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const onFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError(null);
    setResult(null);
    setBusy(true);
    try {
      setReport(await api.importCsv(file));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const patchRow = async (rowIndex, field, value) => {
    const updated = await api.patchImportRow(report.jobId, rowIndex, { [field]: value });
    setReport(updated);
  };

  const commit = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await api.commitImport(report.jobId));
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
        رفع → تحقق → تأكيد. لن يتم استيراد أي صف طالما توجد أخطاء في الملف — عدّل الصفوف أدناه ثم أكّد.
      </p>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <button onClick={downloadTemplate} style={{ border: 'none', background: 'var(--on-indigo-subtle)', color: 'var(--sand)', borderRadius: 'var(--radius-sm)', padding: '9px 14px', cursor: 'pointer', fontFamily: 'var(--font-arabic)', fontSize: '13px' }}>
          تنزيل القالب
        </button>
        <input ref={fileRef} type="file" accept=".csv" onChange={onFile} style={{ fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--sand)' }} />
      </div>

      {error && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--coral)' }}>{error}</p>}
      {result && <p style={{ margin: 0, fontFamily: 'var(--font-arabic)', fontSize: '13px', color: 'var(--teal-ink)' }}>تم استيراد {result.created} سؤالاً بنجاح.</p>}

      {report && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                  <th style={th}>label_id</th>
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
                      <input defaultValue={row.labelId} onBlur={(e) => patchRow(row.rowIndex, 'labelId', e.target.value)} style={cellInput} />
                    </td>
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

          <Button variant="primary" disabled={busy || report.errorRows > 0} onClick={commit}>
            {busy ? 'جاري التأكيد…' : `تأكيد استيراد ${report.validRows} سؤال`}
          </Button>
        </div>
      )}
    </div>
  );
}

const th = { padding: '8px 10px' };
const td = { padding: '6px 10px', verticalAlign: 'top' };
const cellInput = { padding: '4px 6px', borderRadius: '4px', border: 'none', background: 'var(--indigo)', color: 'var(--sand)', fontFamily: 'var(--font-arabic)', fontSize: '12px' };
