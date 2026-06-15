import * as fs from 'fs';
import * as path from 'path';
import { AgentMessage } from './types';

export interface SharedPaths {
  base: string;
  input: string;
  processing: string;
  output: string;
  results: string;
}

export function sharedPaths(base: string): SharedPaths {
  return {
    base,
    input: path.join(base, 'input'),
    processing: path.join(base, 'processing'),
    output: path.join(base, 'output'),
    results: path.join(base, 'results'),
  };
}

export function ensureDirs(base: string): SharedPaths {
  const p = sharedPaths(base);
  for (const dir of [p.input, p.processing, p.output, p.results]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return p;
}

export function writeMessage(dir: string, msg: AgentMessage): string {
  const file = path.join(dir, `${msg.data.transaction_id}.json`);
  fs.writeFileSync(file, JSON.stringify(msg, null, 2), 'utf-8');
  return file;
}

export function readMessage(dir: string, transactionId: string): AgentMessage {
  const file = path.join(dir, `${transactionId}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as AgentMessage;
}

export function moveMessage(fromDir: string, toDir: string, transactionId: string): void {
  const from = path.join(fromDir, `${transactionId}.json`);
  const to = path.join(toDir, `${transactionId}.json`);
  fs.mkdirSync(toDir, { recursive: true });
  fs.renameSync(from, to);
}

export function removeMessage(dir: string, transactionId: string): void {
  const file = path.join(dir, `${transactionId}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function readResults(base: string): AgentMessage[] {
  const dir = sharedPaths(base).results;
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')) as AgentMessage);
}

export function clearShared(base: string): void {
  const p = sharedPaths(base);
  for (const dir of [p.input, p.processing, p.output, p.results]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith('.json')) fs.unlinkSync(path.join(dir, f));
    }
  }
}
