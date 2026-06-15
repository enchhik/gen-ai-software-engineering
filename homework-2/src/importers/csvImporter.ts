import { parse } from 'csv-parse';

export function parseCSV(buffer: Buffer): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    parse(buffer, { columns: true, skip_empty_lines: true, relax_column_count: false }, (err, records: Record<string, string>[]) => {
      if (err) return reject(new Error(`Malformed CSV: ${err.message}`));
      resolve(records.map(unflatten));
    });
  });
}

function unflatten(flat: Record<string, string>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    if (parts.length === 1) {
      result[key] = key === 'tags' ? parseTags(value) : value;
    } else {
      const [parent, child] = parts;
      if (!result[parent]) result[parent] = {};
      (result[parent] as Record<string, string>)[child] = value;
    }
  }
  return result;
}

function parseTags(value: string): string[] {
  if (!value || value.trim() === '') return [];
  return value.split(';').map((t) => t.trim()).filter(Boolean);
}