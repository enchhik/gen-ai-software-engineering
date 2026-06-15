import { parseJSON } from '../../src/importers/jsonImporter';

const toBuffer = (s: string) => Buffer.from(s, 'utf-8');

const VALID_JSON = JSON.stringify([
  {
    customer_id: 'cust-1',
    customer_email: 'alice@example.com',
    customer_name: 'Alice',
    subject: 'Login issue',
    description: 'I cannot login to my account.',
    tags: ['billing', 'urgent'],
    metadata: { source: 'web_form', browser: 'Chrome 120', device_type: 'desktop' },
  },
  {
    customer_id: 'cust-2',
    customer_email: 'bob@example.com',
    customer_name: 'Bob',
    subject: 'App crash',
    description: 'The app crashes on startup every time.',
    tags: [],
    metadata: { source: 'api', browser: 'n/a', device_type: 'mobile' },
  },
]);

describe('parseJSON - valid input', () => {
  test('returns array of raw objects', () => {
    const rows = parseJSON(toBuffer(VALID_JSON));
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(2);
  });

  test('preserves scalar fields', () => {
    const [row] = parseJSON(toBuffer(VALID_JSON));
    expect(row.customer_id).toBe('cust-1');
    expect(row.customer_email).toBe('alice@example.com');
    expect(row.subject).toBe('Login issue');
  });

  test('preserves nested metadata object', () => {
    const [row] = parseJSON(toBuffer(VALID_JSON));
    expect((row.metadata as Record<string, unknown>).source).toBe('web_form');
    expect((row.metadata as Record<string, unknown>).browser).toBe('Chrome 120');
    expect((row.metadata as Record<string, unknown>).device_type).toBe('desktop');
  });

  test('preserves tags array', () => {
    const [row] = parseJSON(toBuffer(VALID_JSON));
    expect(row.tags).toEqual(['billing', 'urgent']);
  });

  test('empty array returns empty result', () => {
    const rows = parseJSON(toBuffer('[]'));
    expect(rows).toEqual([]);
  });
});

describe('parseJSON - invalid input', () => {
  test('throws on invalid JSON syntax', () => {
    expect(() => parseJSON(toBuffer('{not json'))).toThrow();
  });

  test('throws when root is an object, not an array', () => {
    expect(() => parseJSON(toBuffer('{"key":"value"}'))).toThrow();
  });

  test('throws when root is a string', () => {
    expect(() => parseJSON(toBuffer('"just a string"'))).toThrow();
  });

  test('throws when root is null', () => {
    expect(() => parseJSON(toBuffer('null'))).toThrow();
  });
});