import * as path from 'path';
import { dryRunValidate } from '../scripts/validate';

describe('dryRunValidate', () => {
  it('reports valid/invalid counts over the sample without processing', () => {
    const report = dryRunValidate(path.join(__dirname, '..', 'sample-transactions.json'));
    expect(report.total).toBe(8);
    expect(report.valid).toBe(6);
    expect(report.invalid).toBe(2);
    const ids = report.rejections.map((r) => r.transaction_id).sort();
    expect(ids).toEqual(['TXN006', 'TXN007']);
  });
});
