/**
 * ADM-093 — turn rows of objects into a CSV the user can open in Excel.
 *
 * Two details that matter for Arabic content:
 *
 * 1. The BOM. Excel on Windows reads a CSV without one as the local ANSI
 *    codepage, which renders every Arabic name as mojibake. Every other
 *    reader ignores it, so it is the cheap correct default.
 * 2. Quoting. Arabic label names contain commas often enough, and a bare
 *    value with a comma silently shifts every later column on that row.
 */
export function toCsv(rows) {
  if (rows.length === 0) return '﻿';
  const headers = Object.keys(rows[0]);
  const cell = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => cell(r[h])).join(','))];
  // CRLF: the line ending Excel expects, and harmless everywhere else.
  return `﻿${lines.join('\r\n')}`;
}

/** Hand the browser a file without a round trip to the server. */
export function downloadCsv(filename, rows) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
