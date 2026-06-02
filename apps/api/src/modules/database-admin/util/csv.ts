/** Parser/serializador CSV minimalista (RFC-4180-ish) com detecção de delimitador. */

export function detectDelimiter(sample: string): ',' | ';' | '\t' {
  const firstLine = sample.split(/\r?\n/)[0] ?? '';
  const counts = { ',': 0, ';': 0, '\t': 0 } as Record<string, number>;
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === ',' || ch === ';' || ch === '\t')) counts[ch]++;
  }
  if (counts[';'] >= counts[','] && counts[';'] >= counts['\t']) return ';';
  if (counts['\t'] > counts[','] && counts['\t'] > counts[';']) return '\t';
  return ',';
}

export function parseCsv(text: string, delimiter?: string): { header: string[]; rows: string[][] } {
  const delim = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
  const header = nonEmpty.shift() ?? [];
  return { header: header.map((h) => h.trim()), rows: nonEmpty };
}

export function toCsv(columns: string[], rows: Record<string, unknown>[], delimiter = ';'): string {
  const esc = (v: unknown) => `"${(v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)).replace(/"/g, '""')}"`;
  const header = columns.map(esc).join(delimiter);
  const lines = rows.map((r) => columns.map((c) => esc(r[c])).join(delimiter));
  return [header, ...lines].join('\n');
}
