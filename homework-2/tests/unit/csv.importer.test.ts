import { parseCSV } from '../../src/importers/csvImporter';

const toBuffer = (s: string) => Buffer.from(s, 'utf-8');

const VALID_CSV = `customer_id,customer_email,customer_name,subject,description,metadata.source,metadata.browser,metadata.device_type,tags
cust-1,alice@example.com,Alice,Login issue,I cannot login to my account.,web_form,Chrome 120,desktop,billing;urgent
cust-2,bob@example.com,Bob,App crash,The app crashes on startup every time.,api,n/a,mobile,`;

describe('parseCSV - valid input', () => {
  test('returns an array of raw objects', async () => {
    const rows = await parseCSV(toBuffer(VALID_CSV));
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(2);
  });

  test('maps scalar fields correctly', async () => {
    const [row] = await parseCSV(toBuffer(VALID_CSV));
    expect(row.customer_id).toBe('cust-1');
    expect(row.customer_email).toBe('alice@example.com');
    expect(row.customer_name).toBe('Alice');
    expect(row.subject).toBe('Login issue');
    expect(row.description).toBe('I cannot login to my account.');
  });

  test('unflattens dotted metadata headers into nested object', async () => {
    const [row] = await parseCSV(toBuffer(VALID_CSV));
    expect(row.metadata).toBeDefined();
    expect((row.metadata as Record<string, unknown>).source).toBe('web_form');
    expect((row.metadata as Record<string, unknown>).browser).toBe('Chrome 120');
    expect((row.metadata as Record<string, unknown>).device_type).toBe('desktop');
  });

  test('splits semicolon-separated tags into array', async () => {
    const [row] = await parseCSV(toBuffer(VALID_CSV));
    expect(Array.isArray(row.tags)).toBe(true);
    expect(row.tags).toEqual(['billing', 'urgent']);
  });

  test('empty tags column becomes empty array', async () => {
    const rows = await parseCSV(toBuffer(VALID_CSV));
    const second = rows[1];
    expect(second.tags).toEqual([]);
  });
});

describe('parseCSV - edge cases', () => {
  test('header-only CSV returns empty array', async () => {
    const csv = 'customer_id,customer_email,customer_name,subject,description';
    const rows = await parseCSV(toBuffer(csv));
    expect(rows).toEqual([]);
  });

  test('throws on malformed CSV (unterminated quote)', async () => {
    const bad = 'customer_id,customer_email\n"unclosed,value@x.com';
    await expect(parseCSV(toBuffer(bad))).rejects.toThrow();
  });
});