import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runPipeline } from '../lib/pipeline';
import { TransactionData } from '../lib/types';
import { STATUS } from '../lib/constants';

function tx(id: string, amount: string, currency = 'USD', country = 'US'): Partial<TransactionData> {
  return {
    transaction_id: id, amount, currency, transaction_type: 'transfer',
    timestamp: '2026-03-16T09:00:00Z', source_account: 'ACC-1', destination_account: 'ACC-2',
    metadata: { country },
  };
}

describe('runPipeline', () => {
  it('routes settled, flagged, and rejected to results; all transactions appear', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pipe-'));
    const sharedBase = path.join(base, 'shared');
    const logPath = path.join(base, 'audit.log');
    const txns = [
      tx('TXN001', '1500.00'),
      tx('TXN002', '25000.00'),
      tx('TXN006', '200.00', 'XYZ'),
    ] as TransactionData[];

    const summary = runPipeline(txns, sharedBase, logPath);

    const byId = (id: string) => summary.results.find((r) => r.data.transaction_id === id)!;
    expect(summary.results).toHaveLength(3);
    expect(byId('TXN001').data.status).toBe(STATUS.SETTLED);
    expect(byId('TXN002').data.status).toBe(STATUS.FLAGGED);
    expect(byId('TXN006').data.status).toBe(STATUS.REJECTED);
    expect(summary.counts).toEqual({ settled: 1, flagged: 1, rejected: 1, total: 3 });
    expect(fs.existsSync(logPath)).toBe(true);
  });
});
