import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { appendAudit } from '../lib/audit';

describe('audit', () => {
  it('appends an ISO-timestamped line without PII', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-'));
    const logPath = path.join(dir, 'audit.log');
    appendAudit(logPath, 'transaction_validator', 'TXN001', 'validated');
    const content = fs.readFileSync(logPath, 'utf-8').trim();
    expect(content).toMatch(/^\d{4}-\d{2}-\d{2}T.*Z \| transaction_validator \| TXN001 \| validated$/);
    expect(content).not.toContain('ACC-');
  });
});
