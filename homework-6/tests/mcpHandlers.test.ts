import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runPipeline } from '../lib/pipeline';
import { TransactionData } from '../lib/types';
import { getTransactionStatus, listPipelineResults, getSummary } from '../mcp/handlers';

function seed(): string {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-'));
  const sample = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'sample-transactions.json'), 'utf-8'),
  ) as TransactionData[];
  runPipeline(sample, path.join(base, 'shared'), path.join(base, 'audit.log'));
  return path.join(base, 'shared');
}

describe('mcp handlers', () => {
  it('gets a single transaction status', () => {
    const shared = seed();
    const r = getTransactionStatus(shared, 'TXN001');
    expect(r?.status).toBe('settled');
    expect(getTransactionStatus(shared, 'NOPE')).toBeNull();
  });
  it('lists all pipeline results', () => {
    const shared = seed();
    const list = listPipelineResults(shared);
    expect(list).toHaveLength(8);
  });
  it('renders a text summary', () => {
    const shared = seed();
    const text = getSummary(shared);
    expect(text).toMatch(/total: 8/);
    expect(text).toMatch(/settled: 4/);
  });
});
