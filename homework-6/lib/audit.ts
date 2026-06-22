import * as fs from 'fs';
import * as path from 'path';

export function appendAudit(
  logPath: string,
  agent: string,
  transactionId: string,
  outcome: string,
): void {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const line = `${new Date().toISOString()} | ${agent} | ${transactionId} | ${outcome}\n`;
  fs.appendFileSync(logPath, line, 'utf-8');
}
