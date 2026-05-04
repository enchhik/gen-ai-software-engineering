export function parseJSON(buffer: Buffer): Record<string, unknown>[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(buffer.toString('utf-8'));
  } catch {
    throw new Error('Invalid JSON: failed to parse file.');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Invalid JSON: root value must be an array.');
  }

  return parsed as Record<string, unknown>[];
}