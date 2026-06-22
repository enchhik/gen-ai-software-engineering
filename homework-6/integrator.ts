import * as fs from 'fs';
import * as path from 'path';
import { runPipeline } from './lib/pipeline';
import { clearShared } from './lib/sharedIo';
import { TransactionData } from './lib/types';

function main(): void {
  const root = __dirname;
  const sample = JSON.parse(
    fs.readFileSync(path.join(root, 'sample-transactions.json'), 'utf-8'),
  ) as TransactionData[];
  const sharedBase = path.join(root, 'shared');
  const logPath = path.join(root, 'shared', 'audit.log');

  clearShared(sharedBase);
  const summary = runPipeline(sample, sharedBase, logPath);

  console.log('=== Pipeline summary ===');
  console.log(`total: ${summary.counts.total}`);
  console.log(`settled: ${summary.counts.settled}`);
  console.log(`flagged: ${summary.counts.flagged}`);
  console.log(`rejected: ${summary.counts.rejected}`);
  for (const r of summary.results) {
    const d = r.data;
    const extra =
      d.status === 'settled' ? `fee=${d.fee} net=${d.net_amount}` :
      d.status === 'flagged' ? `risk=${d.risk_score}` :
      d.reason ?? '';
    console.log(`- ${d.transaction_id}: ${d.status} ${extra}`);
  }
}

main();
