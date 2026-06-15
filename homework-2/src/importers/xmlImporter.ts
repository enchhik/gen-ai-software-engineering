import { XMLParser, XMLValidator } from 'fast-xml-parser';

const parser = new XMLParser({ isArray: (name) => name === 'ticket' || name === 'tag' });

export function parseXML(buffer: Buffer): Record<string, unknown>[] {
  const xml = buffer.toString('utf-8');

  const valid = XMLValidator.validate(xml);
  if (valid !== true) {
    throw new Error(`Malformed XML: ${valid.err.msg}`);
  }

  const doc = parser.parse(xml) as Record<string, unknown>;

  if (!('tickets' in doc)) {
    throw new Error('Invalid XML: root element must be <tickets>.');
  }

  const tickets = doc['tickets'] as Record<string, unknown> | null;

  if (!tickets || !('ticket' in tickets)) {
    return [];
  }

  const rawTickets = tickets['ticket'] as Record<string, unknown>[];

  return rawTickets.map((t) => {
    const tags = parseTags(t['tags']);
    return { ...t, tags };
  });
}

function parseTags(raw: unknown): string[] {
  if (raw == null) return [];
  if (typeof raw !== 'object') return [];
  const obj = raw as Record<string, unknown>;
  if (!('tag' in obj)) return [];
  const tag = obj['tag'];
  if (Array.isArray(tag)) return tag.map(String);
  return [String(tag)];
}