import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runPipeline } from '../lib/pipeline';
import { TransactionData } from '../lib/types';

describe('integration: full sample', () => {
  it('processes all 8 sample transactions into results with expected outcomes', () => {
    const sample = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'sample-transactions.json'), 'utf-8'),
    ) as TransactionData[];
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'int-'));
    const summary = runPipeline(sample, path.join(base, 'shared'), path.join(base, 'audit.log'));

    expect(summary.counts.total).toBe(8);
    expect(summary.counts.settled).toBe(4);
    expect(summary.counts.flagged).toBe(2);
    expect(summary.counts.rejected).toBe(2);

    const get = (id: string) => summary.results.find((r) => r.data.transaction_id === id)!;
    expect(get('TXN001').data.net_amount).toBe('1492.50');
    expect(get('TXN003').data.fee).toBe('50.00');
    expect(get('TXN006').data.reason).toMatch(/currency/i);
    expect(get('TXN007').data.reason).toMatch(/amount/i);
  });
});
