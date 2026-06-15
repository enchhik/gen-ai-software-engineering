import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { AgentMessage, TransactionData } from '../lib/types';
import { AGENTS, STATUS } from '../lib/constants';
import { validateTransaction } from '../agents/transaction_validator';

export interface ValidateReport {
  total: number;
  valid: number;
  invalid: number;
  rejections: { transaction_id: string; reason: string }[];
}

export function dryRunValidate(samplePath: string): ValidateReport {
  const txns = JSON.parse(fs.readFileSync(samplePath, 'utf-8')) as TransactionData[];
  const rejections: { transaction_id: string; reason: string }[] = [];
  let valid = 0;
  for (const data of txns) {
    const msg: AgentMessage = {
      message_id: uuidv4(), timestamp: new Date().toISOString(),
      source_agent: AGENTS.INTEGRATOR, target_agent: AGENTS.VALIDATOR,
      message_type: 'transaction', data: { ...data, status: 'new' },
    };
    const out = validateTransaction(msg);
    if (out.data.status === STATUS.REJECTED) {
      rejections.push({ transaction_id: data.transaction_id, reason: out.data.reason ?? '' });
    } else {
      valid += 1;
    }
  }
  return { total: txns.length, valid, invalid: rejections.length, rejections };
}

/* istanbul ignore next */
function main(): void {
  const samplePath = require('path').join(__dirname, '..', 'sample-transactions.json');
  const r = dryRunValidate(samplePath);
  console.log(`total=${r.total} valid=${r.valid} invalid=${r.invalid}`);
  console.table(r.rejections);
}

/* istanbul ignore next */
if (require.main === module) main();
