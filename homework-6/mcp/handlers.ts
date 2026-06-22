import { readResults } from '../lib/sharedIo';
import { STATUS } from '../lib/constants';

export interface StatusResult {
  transaction_id: string;
  status: string;
  reason?: string;
  risk_score?: number;
  fee?: string;
  net_amount?: string;
}

export function getTransactionStatus(sharedBase: string, transactionId: string): StatusResult | null {
  const found = readResults(sharedBase).find((m) => m.data.transaction_id === transactionId);
  if (!found) return null;
  const d = found.data;
  return {
    transaction_id: d.transaction_id, status: d.status, reason: d.reason,
    risk_score: d.risk_score, fee: d.fee, net_amount: d.net_amount,
  };
}

export function listPipelineResults(sharedBase: string): StatusResult[] {
  return readResults(sharedBase).map((m) => ({
    transaction_id: m.data.transaction_id, status: m.data.status, reason: m.data.reason,
    risk_score: m.data.risk_score, fee: m.data.fee, net_amount: m.data.net_amount,
  }));
}

export function getSummary(sharedBase: string): string {
  const results = readResults(sharedBase);
  const count = (s: string) => results.filter((r) => r.data.status === s).length;
  const lines = [
    `Pipeline summary`,
    `total: ${results.length}`,
    `settled: ${count(STATUS.SETTLED)}`,
    `flagged: ${count(STATUS.FLAGGED)}`,
    `rejected: ${count(STATUS.REJECTED)}`,
  ];
  return lines.join('\n');
}
