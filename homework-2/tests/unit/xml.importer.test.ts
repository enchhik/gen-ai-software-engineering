import { parseXML } from '../../src/importers/xmlImporter';

const toBuffer = (s: string) => Buffer.from(s, 'utf-8');

const VALID_XML = `<?xml version="1.0"?>
<tickets>
  <ticket>
    <customer_id>cust-1</customer_id>
    <customer_email>alice@example.com</customer_email>
    <customer_name>Alice</customer_name>
    <subject>Login issue</subject>
    <description>I cannot login to my account.</description>
    <metadata>
      <source>web_form</source>
      <browser>Chrome 120</browser>
      <device_type>desktop</device_type>
    </metadata>
    <tags>
      <tag>billing</tag>
      <tag>urgent</tag>
    </tags>
  </ticket>
  <ticket>
    <customer_id>cust-2</customer_id>
    <customer_email>bob@example.com</customer_email>
    <customer_name>Bob</customer_name>
    <subject>App crash</subject>
    <description>The app crashes on startup every time.</description>
    <metadata>
      <source>api</source>
      <browser>n/a</browser>
      <device_type>mobile</device_type>
    </metadata>
    <tags/>
  </ticket>
</tickets>`;

const EMPTY_XML = `<?xml version="1.0"?><tickets/>`;

describe('parseXML - valid input', () => {
  test('returns array of raw objects', () => {
    const rows = parseXML(toBuffer(VALID_XML));
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBe(2);
  });

  test('maps scalar fields correctly', () => {
    const [row] = parseXML(toBuffer(VALID_XML));
    expect(row.customer_id).toBe('cust-1');
    expect(row.customer_email).toBe('alice@example.com');
    expect(row.subject).toBe('Login issue');
  });

  test('parses nested metadata element into object', () => {
    const [row] = parseXML(toBuffer(VALID_XML));
    const meta = row.metadata as Record<string, unknown>;
    expect(meta.source).toBe('web_form');
    expect(meta.browser).toBe('Chrome 120');
    expect(meta.device_type).toBe('desktop');
  });

  test('parses <tags><tag> into an array', () => {
    const [row] = parseXML(toBuffer(VALID_XML));
    expect(Array.isArray(row.tags)).toBe(true);
    expect(row.tags).toEqual(['billing', 'urgent']);
  });

  test('empty <tags/> becomes empty array', () => {
    const rows = parseXML(toBuffer(VALID_XML));
    expect(rows[1].tags).toEqual([]);
  });

  test('empty <tickets/> returns empty array', () => {
    const rows = parseXML(toBuffer(EMPTY_XML));
    expect(rows).toEqual([]);
  });
});

describe('parseXML - invalid input', () => {
  test('throws on malformed XML (unclosed tag)', () => {
    const bad = '<tickets><ticket><subject>test</tickets>';
    expect(() => parseXML(toBuffer(bad))).toThrow();
  });

  test('throws when root element is not <tickets>', () => {
    const wrong = '<items><item><subject>x</subject></item></items>';
    expect(() => parseXML(toBuffer(wrong))).toThrow();
  });
});