# Homework 6 — Multi-Agent Banking Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, in TypeScript, a deterministic multi-agent banking pipeline (Validator → Fraud Detector → Settlement Processor) that communicates via JSON files in `shared/`, plus the four meta-agent deliverables (spec, code, tests+coverage gate, docs) and two MCP servers.

**Architecture:** An orchestrator (`integrator.ts`) loads `sample-transactions.json`, writes one message per transaction into `shared/input/`, then runs three pure agent functions sequentially. A thin `runAgent` helper performs the `input → processing → output/results` file dance and audit logging. Short-circuit: the moment an agent rejects/flags a transaction it goes straight to `shared/results/`; every transaction ends in `shared/results/`.

**Tech Stack:** Node.js, TypeScript, Jest + ts-jest (coverage), `decimal.js` (money), `@modelcontextprotocol/sdk` (custom MCP server), context7 MCP (lookup during build).

**Reference:** Design doc `homework-6/docs/superpowers/specs/2026-06-15-banking-pipeline-design.md`. Source of truth `homework-6/TASKS.md`.

---

## Concrete business rules (decided for this plan)

These were deferred at brainstorm; locked here so code has no placeholders. They also go verbatim into `specification.md`.

**Home country:** `US`. **Decimal:** `decimal.js`, rounding `ROUND_HALF_UP`, 2-dp money.

**Validator** — reject if any:
- Missing/empty required field: `transaction_id, timestamp, source_account, destination_account, amount, currency, transaction_type`.
- `amount` not a finite decimal, or `<= 0`. (rejects `TXN007` `-100.00`)
- `currency` not in the ISO 4217 allow-list. (rejects `TXN006` `XYZ`)
- Pass → `status: "validated"`, route to `fraud_detector`.

**Fraud Detector** — risk score (start 0), then threshold:
- `amount >= 10000` → `+50` (high value).
- `9000 <= amount < 10000` → `+30` (structuring / just-under-threshold).
- `metadata.country !== "US"` → `+20` (cross-border).
- transaction hour (UTC) in `[0,5)` → `+15` (off-hours).
- `score >= 50` → `status: "flagged"` (short-circuit to results). Else `status: "cleared"`, attach `risk_score`, route to `settlement_processor`.

**Settlement Processor:**
- `fee = round_half_up(amount * 0.005, 2)`, `net_amount = amount - fee`.
- `status: "settled"`, attach `fee`, `net_amount`, `settled_at` (ISO 8601 now).

**Expected outcome on the 8 sample transactions:**
| txn | amount | result |
|---|---|---|
| TXN001 | 1500.00 USD | settled (fee 7.50, net 1492.50) |
| TXN002 | 25000.00 USD | flagged (score 50) |
| TXN003 | 9999.99 USD | settled (score 30; fee 50.00, net 9949.99) |
| TXN004 | 500.00 EUR/DE | settled (score 20; fee 2.50, net 497.50) |
| TXN005 | 75000.00 USD | flagged (score 50) |
| TXN006 | 200.00 XYZ | rejected (currency) |
| TXN007 | -100.00 GBP | rejected (amount) |
| TXN008 | 3200.00 USD | settled (fee 16.00, net 3184.00) |

All 8 land in `shared/results/`.

**Audit / PII:** audit log lines = `ISO8601 | agent | transaction_id | outcome`. Never log `source_account`, `destination_account`, or `description`.

---

## File structure

```
homework-6/
├── package.json                tsc/jest/scripts; coverageThreshold 80
├── tsconfig.json
├── jest.config.ts
├── lib/
│   ├── types.ts                AgentMessage, TransactionData, enums
│   ├── constants.ts            ISO codes, thresholds, agent names, statuses, dirs
│   ├── money.ts                Decimal helpers (parse, fee, round)
│   ├── audit.ts                appendAudit(logPath, agent, txnId, outcome)
│   ├── sharedIo.ts             ensureDirs, writeMessage, moveMessage, readResults, clearShared
│   └── pipeline.ts             runAgent helper + runPipeline orchestration
├── agents/
│   ├── transaction_validator.ts   validateTransaction(msg) → msg
│   ├── fraud_detector.ts          detectFraud(msg) → msg
│   └── settlement_processor.ts    settleTransaction(msg) → msg
├── integrator.ts               thin CLI entry → runPipeline
├── scripts/
│   ├── validate.ts             dry-run validator over sample (for /validate-transactions)
│   ├── check-coverage.ts       reads coverage-summary.json, exit 1 if <80
│   └── install-hooks.sh        installs .git/hooks/pre-push
├── mcp/
│   ├── handlers.ts             getTransactionStatus, listPipelineResults, getSummary (pure)
│   └── server.ts               thin MCP wiring (excluded from coverage)
├── .claude/
│   ├── commands/{write-spec,run-pipeline,validate-transactions}.md
│   └── settings.json           PreToolUse coverage gate hook
├── mcp.json                    context7 + pipeline-status
├── shared/                     input/ processing/ output/ results/ (gitkept, runtime-populated)
├── tests/                      unit per agent/module + integration
├── specification.md  agents.md  research-notes.md  README.md  HOWTORUN.md
└── sample-transactions.json    (exists)
```

Coverage is kept ≥90% by making entry points thin: pure logic lives in `lib/`, `agents/`, `mcp/handlers.ts` (all tested); `integrator.ts` and `mcp/server.ts` are excluded from `collectCoverageFrom`.

---

## Phase 0 — Project scaffold

### Task 0.1: Initialize the TypeScript project

**Files:**
- Create: `homework-6/package.json`, `homework-6/tsconfig.json`, `homework-6/jest.config.ts`, `homework-6/.gitignore`

- [ ] **Step 1: Create `homework-6/package.json`**

```json
{
  "name": "homework-6-banking-pipeline",
  "version": "1.0.0",
  "description": "Multi-agent banking transaction pipeline",
  "license": "MIT",
  "author": "Denys Ostrometskyi",
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "test:cov": "jest --coverage",
    "pipeline": "ts-node integrator.ts",
    "validate": "ts-node scripts/validate.ts",
    "mcp": "ts-node mcp/server.ts",
    "check-coverage": "ts-node scripts/check-coverage.ts",
    "install-hooks": "bash scripts/install-hooks.sh"
  },
  "dependencies": {
    "decimal.js": "^10.4.3",
    "uuid": "^9.0.1",
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/jest": "^29.5.12",
    "@types/node": "^20.11.0",
    "@types/uuid": "^9.0.7",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.2",
    "ts-node": "^10.9.2",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `homework-6/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["lib", "agents", "mcp", "scripts", "integrator.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create `homework-6/jest.config.ts`**

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverage: false,
  collectCoverageFrom: [
    'lib/**/*.ts',
    'agents/**/*.ts',
    'mcp/handlers.ts',
    'scripts/validate.ts',
  ],
  coverageReporters: ['text', 'json-summary', 'lcov'],
  coverageThreshold: {
    global: { branches: 80, functions: 80, lines: 80, statements: 80 },
  },
};

export default config;
```

- [ ] **Step 4: Create `homework-6/.gitignore`**

```
node_modules/
dist/
coverage/
shared/input/*
shared/processing/*
shared/output/*
shared/results/*
!shared/**/.gitkeep
*.log
```

- [ ] **Step 5: Install dependencies**

Run: `cd homework-6 && npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add homework-6/package.json homework-6/package-lock.json homework-6/tsconfig.json homework-6/jest.config.ts homework-6/.gitignore
git commit -m "chore(homework-6): scaffold typescript project"
```

### Task 0.2: Create shared/ directory skeleton

**Files:**
- Create: `homework-6/shared/{input,processing,output,results}/.gitkeep`

- [ ] **Step 1: Create the four directories with .gitkeep**

Run:
```bash
cd homework-6 && mkdir -p shared/input shared/processing shared/output shared/results && touch shared/input/.gitkeep shared/processing/.gitkeep shared/output/.gitkeep shared/results/.gitkeep
```
Expected: four dirs each containing `.gitkeep`.

- [ ] **Step 2: Commit**

```bash
git add homework-6/shared
git commit -m "chore(homework-6): add shared pipeline directory skeleton"
```

---

## Phase 1 — Core types & utilities (lib/)

### Task 1.1: Types and constants

**Files:**
- Create: `homework-6/lib/types.ts`, `homework-6/lib/constants.ts`
- Test: `homework-6/tests/constants.test.ts`

- [ ] **Step 1: Write the failing test** — `homework-6/tests/constants.test.ts`

```typescript
import { ISO_4217, isValidCurrency, AGENTS, STATUS } from '../lib/constants';

describe('constants', () => {
  it('accepts known ISO 4217 codes', () => {
    expect(isValidCurrency('USD')).toBe(true);
    expect(isValidCurrency('EUR')).toBe(true);
    expect(isValidCurrency('GBP')).toBe(true);
    expect(isValidCurrency('JPY')).toBe(true);
  });
  it('rejects unknown codes', () => {
    expect(isValidCurrency('XYZ')).toBe(false);
    expect(isValidCurrency('')).toBe(false);
  });
  it('exposes agent names and statuses', () => {
    expect(AGENTS.VALIDATOR).toBe('transaction_validator');
    expect(STATUS.SETTLED).toBe('settled');
    expect(ISO_4217.has('USD')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd homework-6 && npx jest tests/constants.test.ts`
Expected: FAIL — cannot find module `../lib/constants`.

- [ ] **Step 3: Create `homework-6/lib/types.ts`**

```typescript
export interface TransactionMetadata {
  channel?: string;
  country?: string;
}

export interface TransactionData {
  transaction_id: string;
  timestamp?: string;
  source_account?: string;
  destination_account?: string;
  amount: string;
  currency: string;
  transaction_type?: string;
  description?: string;
  metadata?: TransactionMetadata;
  // pipeline annotations
  status: string;
  reason?: string;
  risk_score?: number;
  fee?: string;
  net_amount?: string;
  settled_at?: string;
}

export interface AgentMessage {
  message_id: string;
  timestamp: string;
  source_agent: string;
  target_agent: string;
  message_type: string;
  data: TransactionData;
}
```

- [ ] **Step 4: Create `homework-6/lib/constants.ts`**

```typescript
export const HOME_COUNTRY = 'US';

export const AGENTS = {
  INTEGRATOR: 'integrator',
  VALIDATOR: 'transaction_validator',
  FRAUD: 'fraud_detector',
  SETTLEMENT: 'settlement_processor',
  RESULTS: 'results',
} as const;

export const STATUS = {
  VALIDATED: 'validated',
  REJECTED: 'rejected',
  CLEARED: 'cleared',
  FLAGGED: 'flagged',
  SETTLED: 'settled',
} as const;

export const THRESHOLDS = {
  HIGH_VALUE: 10000,
  NEAR_LOW: 9000,
  FEE_RATE: 0.005,
  FLAG_SCORE: 50,
  SCORE_HIGH_VALUE: 50,
  SCORE_STRUCTURING: 30,
  SCORE_CROSS_BORDER: 20,
  SCORE_OFF_HOURS: 15,
} as const;

export const REQUIRED_FIELDS = [
  'transaction_id',
  'timestamp',
  'source_account',
  'destination_account',
  'amount',
  'currency',
  'transaction_type',
] as const;

// Minimal ISO 4217 allow-list covering the sample plus common majors.
export const ISO_4217 = new Set<string>([
  'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'CNY',
  'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'UAH',
]);

export function isValidCurrency(code: string): boolean {
  return ISO_4217.has(code);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd homework-6 && npx jest tests/constants.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add homework-6/lib/types.ts homework-6/lib/constants.ts homework-6/tests/constants.test.ts
git commit -m "feat(homework-6): add core types and constants"
```

### Task 1.2: Money helpers

**Files:**
- Create: `homework-6/lib/money.ts`
- Test: `homework-6/tests/money.test.ts`

- [ ] **Step 1: Write the failing test** — `homework-6/tests/money.test.ts`

```typescript
import { parseAmount, isPositiveAmount, calcFee, calcNet } from '../lib/money';

describe('money', () => {
  it('parses valid decimal strings', () => {
    expect(parseAmount('1500.00')?.toFixed(2)).toBe('1500.00');
  });
  it('returns null for non-finite/garbage', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
  it('detects positive amounts', () => {
    expect(isPositiveAmount('1500.00')).toBe(true);
    expect(isPositiveAmount('-100.00')).toBe(false);
    expect(isPositiveAmount('0')).toBe(false);
    expect(isPositiveAmount('abc')).toBe(false);
  });
  it('computes fee with ROUND_HALF_UP at 2dp', () => {
    expect(calcFee('1500.00')).toBe('7.50');
    expect(calcFee('9999.99')).toBe('50.00'); // 49.99995 -> 50.00
    expect(calcFee('3200.00')).toBe('16.00');
  });
  it('computes net = amount - fee', () => {
    expect(calcNet('1500.00', '7.50')).toBe('1492.50');
    expect(calcNet('9999.99', '50.00')).toBe('9949.99');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd homework-6 && npx jest tests/money.test.ts`
Expected: FAIL — cannot find module `../lib/money`.

- [ ] **Step 3: Create `homework-6/lib/money.ts`**

```typescript
import Decimal from 'decimal.js';
import { THRESHOLDS } from './constants';

Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export function parseAmount(raw: string): Decimal | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  try {
    const d = new Decimal(raw);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

export function isPositiveAmount(raw: string): boolean {
  const d = parseAmount(raw);
  return d !== null && d.greaterThan(0);
}

export function calcFee(amount: string): string {
  return new Decimal(amount)
    .times(THRESHOLDS.FEE_RATE)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
}

export function calcNet(amount: string, fee: string): string {
  return new Decimal(amount).minus(new Decimal(fee)).toFixed(2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd homework-6 && npx jest tests/money.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add homework-6/lib/money.ts homework-6/tests/money.test.ts
git commit -m "feat(homework-6): add decimal money helpers"
```

### Task 1.3: Audit logger (PII-safe)

**Files:**
- Create: `homework-6/lib/audit.ts`
- Test: `homework-6/tests/audit.test.ts`

- [ ] **Step 1: Write the failing test** — `homework-6/tests/audit.test.ts`

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd homework-6 && npx jest tests/audit.test.ts`
Expected: FAIL — cannot find module `../lib/audit`.

- [ ] **Step 3: Create `homework-6/lib/audit.ts`**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd homework-6 && npx jest tests/audit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add homework-6/lib/audit.ts homework-6/tests/audit.test.ts
git commit -m "feat(homework-6): add PII-safe audit logger"
```

### Task 1.4: Shared file I/O

**Files:**
- Create: `homework-6/lib/sharedIo.ts`
- Test: `homework-6/tests/sharedIo.test.ts`

- [ ] **Step 1: Write the failing test** — `homework-6/tests/sharedIo.test.ts`

```typescript
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ensureDirs, writeMessage, moveMessage, readResults, clearShared, sharedPaths } from '../lib/sharedIo';
import { AgentMessage } from '../lib/types';

function makeMsg(id: string): AgentMessage {
  return {
    message_id: 'm-' + id,
    timestamp: '2026-03-16T09:00:00Z',
    source_agent: 'integrator',
    target_agent: 'transaction_validator',
    message_type: 'transaction',
    data: { transaction_id: id, amount: '1500.00', currency: 'USD', status: 'new' },
  };
}

describe('sharedIo', () => {
  it('creates the four dirs, writes/moves/reads messages, and clears', () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-'));
    const p = sharedPaths(base);
    ensureDirs(base);
    expect(fs.existsSync(p.input)).toBe(true);
    expect(fs.existsSync(p.results)).toBe(true);

    writeMessage(p.input, makeMsg('TXN001'));
    moveMessage(p.input, p.results, 'TXN001');
    const results = readResults(base);
    expect(results).toHaveLength(1);
    expect(results[0].data.transaction_id).toBe('TXN001');

    clearShared(base);
    expect(readResults(base)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd homework-6 && npx jest tests/sharedIo.test.ts`
Expected: FAIL — cannot find module `../lib/sharedIo`.

- [ ] **Step 3: Create `homework-6/lib/sharedIo.ts`**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd homework-6 && npx jest tests/sharedIo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add homework-6/lib/sharedIo.ts homework-6/tests/sharedIo.test.ts
git commit -m "feat(homework-6): add shared file IO module"
```

---

## Phase 2 — Pipeline agents (agents/)

### Task 2.1: Transaction Validator

**Files:**
- Create: `homework-6/agents/transaction_validator.ts`
- Test: `homework-6/tests/transaction_validator.test.ts`

- [ ] **Step 1: Write the failing test** — `homework-6/tests/transaction_validator.test.ts`

```typescript
import { validateTransaction } from '../agents/transaction_validator';
import { AgentMessage } from '../lib/types';
import { AGENTS, STATUS } from '../lib/constants';

function msg(overrides: Partial<AgentMessage['data']>): AgentMessage {
  return {
    message_id: 'm1',
    timestamp: '2026-03-16T09:00:00Z',
    source_agent: AGENTS.INTEGRATOR,
    target_agent: AGENTS.VALIDATOR,
    message_type: 'transaction',
    data: {
      transaction_id: 'TXN001',
      timestamp: '2026-03-16T09:00:00Z',
      source_account: 'ACC-1001',
      destination_account: 'ACC-2001',
      amount: '1500.00',
      currency: 'USD',
      transaction_type: 'transfer',
      status: 'new',
      ...overrides,
    },
  };
}

describe('validateTransaction', () => {
  it('validates a good transaction and routes to fraud_detector', () => {
    const out = validateTransaction(msg({}));
    expect(out.data.status).toBe(STATUS.VALIDATED);
    expect(out.target_agent).toBe(AGENTS.FRAUD);
    expect(out.source_agent).toBe(AGENTS.VALIDATOR);
  });
  it('rejects an unknown currency', () => {
    const out = validateTransaction(msg({ currency: 'XYZ' }));
    expect(out.data.status).toBe(STATUS.REJECTED);
    expect(out.target_agent).toBe(AGENTS.RESULTS);
    expect(out.data.reason).toMatch(/currency/i);
  });
  it('rejects a non-positive amount', () => {
    const out = validateTransaction(msg({ amount: '-100.00' }));
    expect(out.data.status).toBe(STATUS.REJECTED);
    expect(out.data.reason).toMatch(/amount/i);
  });
  it('rejects a missing required field', () => {
    const out = validateTransaction(msg({ source_account: '' }));
    expect(out.data.status).toBe(STATUS.REJECTED);
    expect(out.data.reason).toMatch(/source_account/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd homework-6 && npx jest tests/transaction_validator.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Create `homework-6/agents/transaction_validator.ts`**

```typescript
import { AgentMessage } from '../lib/types';
import { AGENTS, STATUS, REQUIRED_FIELDS, isValidCurrency } from '../lib/constants';
import { isPositiveAmount } from '../lib/money';

function reject(msg: AgentMessage, reason: string): AgentMessage {
  return {
    ...msg,
    source_agent: AGENTS.VALIDATOR,
    target_agent: AGENTS.RESULTS,
    data: { ...msg.data, status: STATUS.REJECTED, reason },
  };
}

export function validateTransaction(msg: AgentMessage): AgentMessage {
  const d = msg.data;
  for (const field of REQUIRED_FIELDS) {
    const value = (d as Record<string, unknown>)[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      return reject(msg, `missing required field: ${field}`);
    }
  }
  if (!isPositiveAmount(d.amount)) {
    return reject(msg, `invalid amount: must be a positive decimal`);
  }
  if (!isValidCurrency(d.currency)) {
    return reject(msg, `invalid currency: ${d.currency} is not ISO 4217`);
  }
  return {
    ...msg,
    source_agent: AGENTS.VALIDATOR,
    target_agent: AGENTS.FRAUD,
    data: { ...d, status: STATUS.VALIDATED, reason: undefined },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd homework-6 && npx jest tests/transaction_validator.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add homework-6/agents/transaction_validator.ts homework-6/tests/transaction_validator.test.ts
git commit -m "feat(homework-6): add transaction validator agent"
```

### Task 2.2: Fraud Detector

**Files:**
- Create: `homework-6/agents/fraud_detector.ts`
- Test: `homework-6/tests/fraud_detector.test.ts`

- [ ] **Step 1: Write the failing test** — `homework-6/tests/fraud_detector.test.ts`

```typescript
import { detectFraud, scoreTransaction } from '../agents/fraud_detector';
import { AgentMessage } from '../lib/types';
import { AGENTS, STATUS } from '../lib/constants';

function msg(amount: string, country = 'US', timestamp = '2026-03-16T09:00:00Z'): AgentMessage {
  return {
    message_id: 'm1',
    timestamp,
    source_agent: AGENTS.VALIDATOR,
    target_agent: AGENTS.FRAUD,
    message_type: 'transaction',
    data: {
      transaction_id: 'TXN', amount, currency: 'USD', status: STATUS.VALIDATED,
      timestamp, metadata: { country },
    },
  };
}

describe('fraud detector', () => {
  it('scores high-value transactions', () => {
    expect(scoreTransaction(msg('25000.00').data)).toBe(50);
  });
  it('scores structuring (just under 10k)', () => {
    expect(scoreTransaction(msg('9999.99').data)).toBe(30);
  });
  it('scores cross-border', () => {
    expect(scoreTransaction(msg('500.00', 'DE').data)).toBe(20);
  });
  it('scores off-hours', () => {
    expect(scoreTransaction(msg('1500.00', 'US', '2026-03-16T03:00:00Z').data)).toBe(15);
  });
  it('flags when score >= 50 and routes to results', () => {
    const out = detectFraud(msg('75000.00'));
    expect(out.data.status).toBe(STATUS.FLAGGED);
    expect(out.target_agent).toBe(AGENTS.RESULTS);
    expect(out.data.risk_score).toBe(50);
  });
  it('clears low-risk and routes to settlement', () => {
    const out = detectFraud(msg('1500.00'));
    expect(out.data.status).toBe(STATUS.CLEARED);
    expect(out.target_agent).toBe(AGENTS.SETTLEMENT);
    expect(out.data.risk_score).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd homework-6 && npx jest tests/fraud_detector.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Create `homework-6/agents/fraud_detector.ts`**

```typescript
import { AgentMessage, TransactionData } from '../lib/types';
import { AGENTS, STATUS, THRESHOLDS, HOME_COUNTRY } from '../lib/constants';
import Decimal from 'decimal.js';

export function scoreTransaction(d: TransactionData): number {
  let score = 0;
  const amount = new Decimal(d.amount);
  if (amount.greaterThanOrEqualTo(THRESHOLDS.HIGH_VALUE)) {
    score += THRESHOLDS.SCORE_HIGH_VALUE;
  } else if (amount.greaterThanOrEqualTo(THRESHOLDS.NEAR_LOW)) {
    score += THRESHOLDS.SCORE_STRUCTURING;
  }
  const country = d.metadata?.country;
  if (country && country !== HOME_COUNTRY) {
    score += THRESHOLDS.SCORE_CROSS_BORDER;
  }
  if (d.timestamp) {
    const hour = new Date(d.timestamp).getUTCHours();
    if (hour >= 0 && hour < 5) score += THRESHOLDS.SCORE_OFF_HOURS;
  }
  return score;
}

export function detectFraud(msg: AgentMessage): AgentMessage {
  const score = scoreTransaction(msg.data);
  const flagged = score >= THRESHOLDS.FLAG_SCORE;
  return {
    ...msg,
    source_agent: AGENTS.FRAUD,
    target_agent: flagged ? AGENTS.RESULTS : AGENTS.SETTLEMENT,
    data: {
      ...msg.data,
      risk_score: score,
      status: flagged ? STATUS.FLAGGED : STATUS.CLEARED,
      reason: flagged ? `risk score ${score} >= ${THRESHOLDS.FLAG_SCORE}` : undefined,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd homework-6 && npx jest tests/fraud_detector.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add homework-6/agents/fraud_detector.ts homework-6/tests/fraud_detector.test.ts
git commit -m "feat(homework-6): add fraud detector agent"
```

### Task 2.3: Settlement Processor

**Files:**
- Create: `homework-6/agents/settlement_processor.ts`
- Test: `homework-6/tests/settlement_processor.test.ts`

- [ ] **Step 1: Write the failing test** — `homework-6/tests/settlement_processor.test.ts`

```typescript
import { settleTransaction } from '../agents/settlement_processor';
import { AgentMessage } from '../lib/types';
import { AGENTS, STATUS } from '../lib/constants';

function msg(amount: string): AgentMessage {
  return {
    message_id: 'm1', timestamp: '2026-03-16T09:00:00Z',
    source_agent: AGENTS.FRAUD, target_agent: AGENTS.SETTLEMENT, message_type: 'transaction',
    data: { transaction_id: 'TXN001', amount, currency: 'USD', status: STATUS.CLEARED, risk_score: 0 },
  };
}

describe('settlement processor', () => {
  it('settles with fee and net and routes to results', () => {
    const out = settleTransaction(msg('1500.00'));
    expect(out.data.status).toBe(STATUS.SETTLED);
    expect(out.target_agent).toBe(AGENTS.RESULTS);
    expect(out.data.fee).toBe('7.50');
    expect(out.data.net_amount).toBe('1492.50');
    expect(out.data.settled_at).toMatch(/\dT.*Z$/);
  });
  it('rounds fee HALF_UP', () => {
    const out = settleTransaction(msg('9999.99'));
    expect(out.data.fee).toBe('50.00');
    expect(out.data.net_amount).toBe('9949.99');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd homework-6 && npx jest tests/settlement_processor.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Create `homework-6/agents/settlement_processor.ts`**

```typescript
import { AgentMessage } from '../lib/types';
import { AGENTS, STATUS } from '../lib/constants';
import { calcFee, calcNet } from '../lib/money';

export function settleTransaction(msg: AgentMessage): AgentMessage {
  const fee = calcFee(msg.data.amount);
  const net = calcNet(msg.data.amount, fee);
  return {
    ...msg,
    source_agent: AGENTS.SETTLEMENT,
    target_agent: AGENTS.RESULTS,
    data: {
      ...msg.data,
      status: STATUS.SETTLED,
      fee,
      net_amount: net,
      settled_at: new Date().toISOString(),
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd homework-6 && npx jest tests/settlement_processor.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add homework-6/agents/settlement_processor.ts homework-6/tests/settlement_processor.test.ts
git commit -m "feat(homework-6): add settlement processor agent"
```

---

## Phase 3 — Orchestration (lib/pipeline.ts + integrator.ts)

### Task 3.1: Pipeline runner with short-circuit

**Files:**
- Create: `homework-6/lib/pipeline.ts`
- Test: `homework-6/tests/pipeline.test.ts`

- [ ] **Step 1: Write the failing test** — `homework-6/tests/pipeline.test.ts`

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd homework-6 && npx jest tests/pipeline.test.ts`
Expected: FAIL — cannot find module `../lib/pipeline`.

- [ ] **Step 3: Create `homework-6/lib/pipeline.ts`**

```typescript
import { v4 as uuidv4 } from 'uuid';
import { AgentMessage, TransactionData } from './types';
import { AGENTS, STATUS } from './constants';
import { ensureDirs, writeMessage, moveMessage, removeMessage, readResults } from './sharedIo';
import { appendAudit } from './audit';
import { validateTransaction } from '../agents/transaction_validator';
import { detectFraud } from '../agents/fraud_detector';
import { settleTransaction } from '../agents/settlement_processor';

type AgentFn = (msg: AgentMessage) => AgentMessage;

const CHAIN: { name: string; fn: AgentFn }[] = [
  { name: AGENTS.VALIDATOR, fn: validateTransaction },
  { name: AGENTS.FRAUD, fn: detectFraud },
  { name: AGENTS.SETTLEMENT, fn: settleTransaction },
];

export interface PipelineSummary {
  results: AgentMessage[];
  counts: { settled: number; flagged: number; rejected: number; total: number };
}

function toMessage(data: TransactionData): AgentMessage {
  return {
    message_id: uuidv4(),
    timestamp: new Date().toISOString(),
    source_agent: AGENTS.INTEGRATOR,
    target_agent: AGENTS.VALIDATOR,
    message_type: 'transaction',
    data: { ...data, status: 'new' },
  };
}

export function runPipeline(
  transactions: TransactionData[],
  sharedBase: string,
  logPath: string,
): PipelineSummary {
  const p = ensureDirs(sharedBase);

  for (const data of transactions) {
    let msg = toMessage(data);
    const id = data.transaction_id;
    writeMessage(p.input, msg);
    appendAudit(logPath, AGENTS.INTEGRATOR, id, 'received');

    let current = p.input;
    for (const stage of CHAIN) {
      // agent picks up the message: move it into processing while it works
      moveMessage(current, p.processing, id);
      msg = stage.fn(msg);
      appendAudit(logPath, stage.name, id, msg.data.status);

      // consume the in-flight processing copy regardless of outcome
      removeMessage(p.processing, id);

      if (msg.target_agent === AGENTS.RESULTS) {
        // short-circuit (rejected/flagged) or final settlement → land in results
        writeMessage(p.results, msg);
        break;
      }
      // hand off to the next agent: stage its output as the next input
      writeMessage(p.output, msg);
      moveMessage(p.output, p.input, id);
      current = p.input;
    }
  }

  const results = readResults(sharedBase);
  const counts = {
    settled: results.filter((r) => r.data.status === STATUS.SETTLED).length,
    flagged: results.filter((r) => r.data.status === STATUS.FLAGGED).length,
    rejected: results.filter((r) => r.data.status === STATUS.REJECTED).length,
    total: results.length,
  };
  return { results, counts };
}
```

The `runAgent` file dance (move to `processing`, run the agent, then either land in `results` or
stage `output` → next `input`) keeps `shared/` an honest audit trail while staying deterministic.
`removeMessage` (added to `sharedIo.ts` in Task 1.4) clears the in-flight `processing` copy each step.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd homework-6 && npx jest tests/pipeline.test.ts`
Expected: PASS — counts `{ settled:1, flagged:1, rejected:1, total:3 }`.

- [ ] **Step 5: Commit**

```bash
git add homework-6/lib/pipeline.ts homework-6/tests/pipeline.test.ts
git commit -m "feat(homework-6): add pipeline orchestration with short-circuit"
```

### Task 3.2: Integrator CLI entry + full sample integration test

**Files:**
- Create: `homework-6/integrator.ts`
- Test: `homework-6/tests/integration.test.ts`

- [ ] **Step 1: Write the failing integration test** — `homework-6/tests/integration.test.ts`

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd homework-6 && npx jest tests/integration.test.ts`
Expected: FAIL initially only if counts differ; it should actually PASS against `lib/pipeline` already. If it fails, fix the agent rules to match the expected table, not the test.

- [ ] **Step 3: Create `homework-6/integrator.ts` (thin entry, excluded from coverage)**

```typescript
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
```

- [ ] **Step 4: Run the integration test and the real pipeline**

Run: `cd homework-6 && npx jest tests/integration.test.ts && npm run pipeline`
Expected: test PASS; `npm run pipeline` prints summary with settled 4 / flagged 2 / rejected 2 and writes 8 files into `shared/results/`.

- [ ] **Step 5: Update jest.config.ts to exclude entry points from coverage**

In `homework-6/jest.config.ts`, confirm `collectCoverageFrom` does NOT include `integrator.ts` or `mcp/server.ts` (already excluded in Task 0.1). No change needed if already correct.

- [ ] **Step 6: Commit**

```bash
git add homework-6/integrator.ts homework-6/tests/integration.test.ts
git commit -m "feat(homework-6): add integrator entrypoint and full-sample integration test"
```

---

## Phase 4 — MCP (Task 4)

### Task 4.1: context7 research (during build) → research-notes.md

**Files:**
- Create: `homework-6/research-notes.md`

- [ ] **Step 1: Use the context7 MCP tools during this build**

Run two real context7 lookups via the MCP tools (resolve-library-id then query-docs):
1. decimal/money handling in Node (`decimal.js`).
2. Building an MCP server with `@modelcontextprotocol/sdk` (TypeScript).

- [ ] **Step 2: Create `homework-6/research-notes.md` documenting ≥2 queries**

```markdown
# Research Notes — context7 queries

## Query 1: precise monetary arithmetic in Node
- Search: "decimal.js money rounding ROUND_HALF_UP"
- context7 library ID: <fill from resolve-library-id, e.g. /mikemcl/decimal.js>
- Applied: configured `Decimal.set({ rounding: ROUND_HALF_UP })` and used
  `toDecimalPlaces(2, ROUND_HALF_UP)` for settlement fees so 49.99995 → 50.00. No floats used.

## Query 2: building an MCP server in TypeScript
- Search: "@modelcontextprotocol/sdk server tool resource stdio"
- context7 library ID: <fill from resolve-library-id, e.g. /modelcontextprotocol/typescript-sdk>
- Applied: used `McpServer` with `registerTool` for get_transaction_status /
  list_pipeline_results and `registerResource` for pipeline://summary, over StdioServerTransport.
```

> Fill the two `<...>` library-ID placeholders with the actual IDs context7 returns. These are the
> only intentional fill-ins; do not leave them as placeholders in the committed file.

- [ ] **Step 3: Commit**

```bash
git add homework-6/research-notes.md
git commit -m "docs(homework-6): add context7 research notes"
```

### Task 4.2: MCP handlers (pure, tested)

**Files:**
- Create: `homework-6/mcp/handlers.ts`
- Test: `homework-6/tests/mcpHandlers.test.ts`

- [ ] **Step 1: Write the failing test** — `homework-6/tests/mcpHandlers.test.ts`

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd homework-6 && npx jest tests/mcpHandlers.test.ts`
Expected: FAIL — cannot find module `../mcp/handlers`.

- [ ] **Step 3: Create `homework-6/mcp/handlers.ts`**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd homework-6 && npx jest tests/mcpHandlers.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add homework-6/mcp/handlers.ts homework-6/tests/mcpHandlers.test.ts
git commit -m "feat(homework-6): add MCP query handlers"
```

### Task 4.3: MCP server wiring + mcp.json

**Files:**
- Create: `homework-6/mcp/server.ts`, `homework-6/mcp.json`

- [ ] **Step 1: Create `homework-6/mcp/server.ts` (thin wiring; excluded from coverage)**

```typescript
import * as path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { getTransactionStatus, listPipelineResults, getSummary } from './handlers';

const SHARED = path.join(__dirname, '..', 'shared');

const server = new McpServer({ name: 'pipeline-status', version: '1.0.0' });

server.registerTool(
  'get_transaction_status',
  {
    description: 'Get current status of a transaction from shared/results/',
    inputSchema: { transaction_id: z.string() },
  },
  async ({ transaction_id }) => {
    const r = getTransactionStatus(SHARED, transaction_id);
    return { content: [{ type: 'text', text: r ? JSON.stringify(r, null, 2) : 'not found' }] };
  },
);

server.registerTool(
  'list_pipeline_results',
  { description: 'Summary of all processed transactions', inputSchema: {} },
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(listPipelineResults(SHARED), null, 2) }],
  }),
);

server.registerResource(
  'pipeline-summary',
  'pipeline://summary',
  { description: 'Latest pipeline run summary', mimeType: 'text/plain' },
  async (uri) => ({ contents: [{ uri: uri.href, text: getSummary(SHARED) }] }),
);

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}
main();
```

> If the installed `@modelcontextprotocol/sdk` version's API differs (e.g. `tool()` vs
> `registerTool()`), adjust to the version surfaced by the context7 query in Task 4.1. `zod` is a
> transitive dep of the SDK; if not resolvable, add `"zod": "^3.23.0"` to dependencies and re-install.

- [ ] **Step 2: Create `homework-6/mcp.json`**

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"]
    },
    "pipeline-status": {
      "command": "npx",
      "args": ["ts-node", "mcp/server.ts"]
    }
  }
}
```

- [ ] **Step 3: Smoke-test the server starts**

Run: `cd homework-6 && npm run pipeline && timeout 3 npm run mcp || true`
Expected: no crash on startup (server waits on stdio; timeout ends it).

- [ ] **Step 4: Commit**

```bash
git add homework-6/mcp/server.ts homework-6/mcp.json
git commit -m "feat(homework-6): add custom MCP server and mcp.json"
```

---

## Phase 5 — Skills & coverage gate (Task 3)

### Task 5.1: validate.ts dry-run script

**Files:**
- Create: `homework-6/scripts/validate.ts`
- Test: `homework-6/tests/validateScript.test.ts`

- [ ] **Step 1: Write the failing test** — `homework-6/tests/validateScript.test.ts`

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd homework-6 && npx jest tests/validateScript.test.ts`
Expected: FAIL — cannot find module `../scripts/validate`.

- [ ] **Step 3: Create `homework-6/scripts/validate.ts`**

```typescript
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd homework-6 && npx jest tests/validateScript.test.ts && npm run validate`
Expected: test PASS; `npm run validate` prints `total=8 valid=6 invalid=2` and a table with TXN006/TXN007.

- [ ] **Step 5: Commit**

```bash
git add homework-6/scripts/validate.ts homework-6/tests/validateScript.test.ts
git commit -m "feat(homework-6): add dry-run validate script"
```

### Task 5.2: Coverage-check script

**Files:**
- Create: `homework-6/scripts/check-coverage.ts`

- [ ] **Step 1: Create `homework-6/scripts/check-coverage.ts`**

```typescript
import * as fs from 'fs';
import * as path from 'path';

const THRESHOLD = 80;

function main(): void {
  const summaryPath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');
  if (!fs.existsSync(summaryPath)) {
    console.error(`[coverage-gate] no coverage report at ${summaryPath}. Run: npm run test:cov`);
    process.exit(1);
  }
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
  const linesPct: number = summary.total.lines.pct;
  if (linesPct < THRESHOLD) {
    console.error(`[coverage-gate] BLOCKED: line coverage ${linesPct}% < ${THRESHOLD}%`);
    process.exit(1);
  }
  console.log(`[coverage-gate] OK: line coverage ${linesPct}% >= ${THRESHOLD}%`);
  process.exit(0);
}

main();
```

- [ ] **Step 2: Verify it passes on a fresh coverage run**

Run: `cd homework-6 && npm run test:cov && npm run check-coverage`
Expected: coverage ≥ threshold across all tests; `[coverage-gate] OK: line coverage XX% >= 80%`. If coverage < 90%, add tests to the weakest module before continuing.

- [ ] **Step 3: Verify it BLOCKS when no report exists**

Run: `cd homework-6 && rm -rf coverage && npm run check-coverage; echo "exit=$?"`
Expected: `[coverage-gate] BLOCKED... ` and `exit=1`.

- [ ] **Step 4: Commit**

```bash
git add homework-6/scripts/check-coverage.ts
git commit -m "feat(homework-6): add coverage-gate check script"
```

### Task 5.3: Claude Code settings.json hook + git pre-push installer

**Files:**
- Create: `homework-6/.claude/settings.json`, `homework-6/scripts/install-hooks.sh`

- [ ] **Step 1: Create `homework-6/.claude/settings.json` (PreToolUse coverage gate)**

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "if echo \"$CLAUDE_TOOL_INPUT\" | grep -Eq 'git[[:space:]]+push'; then cd \"$CLAUDE_PROJECT_DIR/homework-6\" && npm run test:cov --silent && npm run check-coverage; fi"
          }
        ]
      }
    ]
  }
}
```

> The hook runs the coverage suite + gate only when the Bash command contains `git push`. A non-zero
> exit from `check-coverage` blocks the tool call (push). Adjust env var names if the installed Claude
> Code version exposes tool input differently; the gate logic (run coverage, exit non-zero) is the
> contract.

- [ ] **Step 2: Create `homework-6/scripts/install-hooks.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOK="$REPO_ROOT/.git/hooks/pre-push"

cat > "$HOOK" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
echo "[pre-push] running coverage gate for homework-6..."
cd "$(git rev-parse --show-toplevel)/homework-6"
npm run test:cov --silent
npm run check-coverage
EOF

chmod +x "$HOOK"
echo "Installed pre-push hook at $HOOK"
```

- [ ] **Step 3: Install and test the git hook blocks under-threshold pushes**

Run: `cd homework-6 && npm run install-hooks`
Expected: "Installed pre-push hook ...". A `git push` will now run the coverage gate first. (Verify by temporarily lowering coverage or inspecting that the hook runs; capture for `hook-trigger.png`.)

- [ ] **Step 4: Commit**

```bash
git add homework-6/.claude/settings.json homework-6/scripts/install-hooks.sh
git commit -m "feat(homework-6): add coverage gate (settings.json hook + pre-push installer)"
```

### Task 5.4: Slash commands (skills)

**Files:**
- Create: `homework-6/.claude/commands/write-spec.md`, `run-pipeline.md`, `validate-transactions.md`

- [ ] **Step 1: Create `homework-6/.claude/commands/write-spec.md`**

```markdown
---
description: Generate a project specification from the homework-6 template
---

Generate `homework-6/specification.md` following the 5-section template from TASKS.md:

1. **High-Level Objective** — one sentence on what the pipeline does.
2. **Mid-Level Objectives** — 4–5 concrete, testable requirements.
3. **Implementation Notes** — decimal money (decimal.js, ROUND_HALF_UP), ISO 4217 currency,
   audit trail (timestamp, agent, transaction id, outcome), no PII in logs.
4. **Context** — beginning state: sample-transactions.json; ending state: results in
   shared/results/, a summary report, coverage ≥ 90%.
5. **Low-Level Tasks** — one entry per agent (transaction_validator, fraud_detector,
   settlement_processor) with Prompt / File to CREATE / Function to CREATE / Details.

Use the concrete business rules from docs/superpowers/specs/2026-06-15-banking-pipeline-design.md.
```

- [ ] **Step 2: Create `homework-6/.claude/commands/run-pipeline.md`**

```markdown
---
description: Run the multi-agent banking pipeline end-to-end
---

Run the multi-agent banking pipeline end-to-end.

Steps:
1. Check that homework-6/sample-transactions.json exists.
2. Clear homework-6/shared/ directories.
3. Run the pipeline: `cd homework-6 && npm run pipeline`.
4. Show a summary of results from homework-6/shared/results/.
5. Report any transactions that were rejected or flagged and why.
```

- [ ] **Step 3: Create `homework-6/.claude/commands/validate-transactions.md`**

```markdown
---
description: Validate transactions without running the full pipeline
---

Validate all transactions in homework-6/sample-transactions.json without processing them.

Steps:
1. Run the validator in dry-run mode: `cd homework-6 && npm run validate`.
2. Report: total count, valid count, invalid count, and reasons for rejection.
3. Show the table of rejected transactions.
```

- [ ] **Step 4: Verify commands are discoverable**

Run: `ls homework-6/.claude/commands/`
Expected: three `.md` files. (In an interactive session, `/run-pipeline` and `/validate-transactions` should appear; capture `skill-run-pipeline.png`.)

- [ ] **Step 5: Commit**

```bash
git add homework-6/.claude/commands
git commit -m "feat(homework-6): add write-spec, run-pipeline, validate-transactions skills"
```

---

## Phase 6 — Specification & agents.md (Task 1)

### Task 6.1: specification.md

**Files:**
- Create: `homework-6/specification.md`

- [ ] **Step 1: Create `homework-6/specification.md`** with all 5 sections, using the locked business rules

Content must include, verbatim where applicable, the rules from the "Concrete business rules" section
of this plan. Structure:

```markdown
# Specification — Multi-Agent Banking Pipeline

## 1. High-Level Objective
A file-driven multi-agent pipeline that validates, fraud-screens, and settles banking
transactions, writing every outcome to shared/results/.

## 2. Mid-Level Objectives
- Transactions failing field/amount/currency checks are rejected with a reason and written to shared/results/.
- Transactions scoring >= 50 on fraud risk are flagged and not settled.
- Cleared transactions are settled with a 0.5% fee (ROUND_HALF_UP) and a net amount.
- Every agent operation is logged with an ISO 8601 timestamp, agent name, transaction id, and outcome.
- All input transactions appear in shared/results/ exactly once.

## 3. Implementation Notes
- Money: decimal.js, never float; ROUND_HALF_UP at 2 dp.
- Currency: ISO 4217 allow-list.
- Logging: audit trail (timestamp | agent | transaction_id | outcome); no account numbers/names/descriptions logged.
- Communication: JSON files through shared/input, shared/processing, shared/output, shared/results.

## 4. Context
- Beginning state: sample-transactions.json (8 raw records).
- Ending state: shared/results/ populated, a pipeline summary report, test coverage >= 90%.

## 5. Low-Level Tasks
Task: Transaction Validator
Prompt: "Create a validator that rejects missing required fields, non-positive amounts, and non-ISO-4217 currencies; otherwise mark validated and route to fraud_detector."
File to CREATE: agents/transaction_validator.ts
Function to CREATE: validateTransaction(msg: AgentMessage): AgentMessage
Details: required fields transaction_id, timestamp, source_account, destination_account, amount, currency, transaction_type; amount > 0; currency in ISO 4217.

Task: Fraud Detector
Prompt: "Create a fraud detector that scores high-value (>=10k:+50), structuring (9k–10k:+30), cross-border (+20), off-hours 00–05 UTC (+15); flag if score>=50 else clear and route to settlement_processor."
File to CREATE: agents/fraud_detector.ts
Function to CREATE: detectFraud(msg: AgentMessage): AgentMessage
Details: short-circuit flagged transactions to results with risk_score and reason.

Task: Settlement Processor
Prompt: "Create a settlement processor that charges a 0.5% fee (ROUND_HALF_UP, 2 dp), computes net amount, marks settled with settled_at, routes to results."
File to CREATE: agents/settlement_processor.ts
Function to CREATE: settleTransaction(msg: AgentMessage): AgentMessage
Details: fee = amount*0.005 rounded half-up; net = amount - fee.
```

- [ ] **Step 2: Commit**

```bash
git add homework-6/specification.md
git commit -m "docs(homework-6): add pipeline specification"
```

### Task 6.2: agents.md

**Files:**
- Create: `homework-6/agents.md`

- [ ] **Step 1: Create `homework-6/agents.md`** (written from scratch; no starter shipped)

```markdown
# agents.md — Multi-Agent Banking Pipeline

## Project context
A deterministic, file-driven banking transaction pipeline. Three runtime agents communicate via
JSON files in shared/. Built and maintained with AI agents (Claude Code) per the four meta-agent
workflow in TASKS.md.

## Tech stack (authoritative — do not improvise)
- Language: TypeScript on Node.js
- Money: decimal.js (ROUND_HALF_UP, 2 dp) — never use number/float for amounts
- Tests: Jest + ts-jest, coverage gate 80% (target >= 90%)
- MCP: @modelcontextprotocol/sdk (custom server) + context7

## Domain rules
- Currency must be ISO 4217.
- Fraud flag threshold: risk score >= 50.
- Settlement fee: 0.5% ROUND_HALF_UP.
- Short-circuit: a rejected/flagged transaction goes straight to shared/results/.
- Every transaction must end in shared/results/ exactly once.

## Code style
- Pure agent functions: (msg: AgentMessage) => AgentMessage; no I/O inside agents.
- File I/O and orchestration live in lib/ and integrator.ts.
- No PII (account numbers, names, descriptions) in logs.

## Verification expectations
- `npm test` green; `npm run test:cov` >= 80% (aim >= 90%).
- `npm run pipeline` writes 8 results for the sample.

## Tie-breaking order of authority
1. TASKS.md  2. specification.md  3. this agents.md  4. design doc  5. agent judgement.
```

- [ ] **Step 2: Commit**

```bash
git add homework-6/agents.md
git commit -m "docs(homework-6): add agents.md project context"
```

---

## Phase 7 — Documentation (Task 5 / Agent 4)

### Task 7.1: README.md

**Files:**
- Create: `homework-6/README.md`

- [ ] **Step 1: Create `homework-6/README.md`** with author name, overview, agent bullets, ASCII diagram, tech-stack table

```markdown
# Homework 6 — Multi-Agent Banking Pipeline

> **Created by Denys Ostrometskyi**

A file-driven, multi-agent pipeline that validates, fraud-screens, and settles banking
transactions. An orchestrator loads raw transactions, then three agents process each one and write
the final outcome to `shared/results/`. Every transaction — settled, flagged, or rejected — ends up
in `shared/results/`.

## Agents
- **Transaction Validator** — checks required fields, positive amount, ISO 4217 currency.
- **Fraud Detector** — risk-scores high-value, structuring, cross-border, off-hours; flags score ≥ 50.
- **Settlement Processor** — charges a 0.5% fee (ROUND_HALF_UP) and settles cleared transactions.

## Architecture
\`\`\`
sample-transactions.json
        |
        v
   [ integrator ]  --writes--> shared/input/
        |
        v
  shared/input -> [Validator] --reject--> shared/results
        |  validated
        v
  [Fraud Detector] --flag--> shared/results
        |  cleared
        v
  [Settlement Processor] --settled--> shared/results
\`\`\`

## Tech stack
| Concern | Choice |
|---|---|
| Language | TypeScript / Node.js |
| Money | decimal.js (ROUND_HALF_UP) |
| Tests | Jest + ts-jest (coverage gate 80%, target ≥ 90%) |
| MCP | @modelcontextprotocol/sdk + context7 |

See `HOWTORUN.md` to run, test, and exercise the MCP server.
```

- [ ] **Step 2: Commit**

```bash
git add homework-6/README.md
git commit -m "docs(homework-6): add README with architecture and author"
```

### Task 7.2: HOWTORUN.md

**Files:**
- Create: `homework-6/HOWTORUN.md`

- [ ] **Step 1: Create `homework-6/HOWTORUN.md`**

```markdown
# How to run — Homework 6

## Prerequisites
- Node.js 20+

## Setup
1. `cd homework-6`
2. `npm install`
3. `npm run install-hooks`   # installs the git pre-push coverage gate

## Run the pipeline
4. `npm run pipeline`        # processes sample-transactions.json into shared/results/
   Expect: total 8, settled 4, flagged 2, rejected 2.

## Validate only (no processing)
5. `npm run validate`        # prints total/valid/invalid + rejection table

## Tests & coverage
6. `npm test`                # all unit + integration tests
7. `npm run test:cov`        # coverage report (target ≥ 90%, gate 80%)
8. `npm run check-coverage`  # the gate; exits non-zero if < 80%

## MCP server
9. Configure `mcp.json` in your client (context7 + pipeline-status).
10. After a pipeline run, call `get_transaction_status` (e.g. TXN001),
    `list_pipeline_results`, or read resource `pipeline://summary`.

## Slash commands (Claude Code)
- `/run-pipeline`, `/validate-transactions`, `/write-spec`.
```

- [ ] **Step 2: Commit**

```bash
git add homework-6/HOWTORUN.md
git commit -m "docs(homework-6): add HOWTORUN guide"
```

### Task 7.3: Screenshots (manual)

**Files:**
- Create: `homework-6/docs/screenshots/*.png`

- [ ] **Step 1: Capture the 5 required screenshots**

Capture into `homework-6/docs/screenshots/`:
- `pipeline-run.png` — `npm run pipeline` output.
- `test-coverage.png` — `npm run test:cov` showing ≥ 80% (ideally ≥ 90%).
- `skill-run-pipeline.png` — `/run-pipeline` executing.
- `hook-trigger.png` — coverage gate firing / blocking a push.
- `mcp-interaction.png` — a context7 query result AND a custom MCP tool call.

- [ ] **Step 2: Commit**

```bash
git add homework-6/docs/screenshots
git commit -m "docs(homework-6): add screenshots of pipeline, coverage, skills, hook, MCP"
```

---

## Phase 8 — Final verification & PR

### Task 8.1: Full green run + coverage ≥ 90%

- [ ] **Step 1: Run the full suite with coverage**

Run: `cd homework-6 && npm run test:cov`
Expected: all tests PASS; global line coverage ≥ 90% (gate 80%). If below 90%, add targeted tests to the weakest file (check the per-file table) and re-run.

- [ ] **Step 2: Run the pipeline and confirm 8 results**

Run: `cd homework-6 && npm run pipeline && ls shared/results | grep -c json`
Expected: summary printed; `8` result files.

- [ ] **Step 3: Final commit if any test additions**

```bash
git add -A homework-6
git commit -m "test(homework-6): raise coverage above 90%"
```

### Task 8.2: Open the PR

- [ ] **Step 1: Push the branch**

Run: `git push -u origin homework-6-submission`
Expected: pre-push coverage gate runs and passes; branch pushed.

- [ ] **Step 2: Open the PR (Ukrainian body, instructor-approved structure)**

Use the HW2-style structure: `/cc @Alexey-Popov`, summary, TASKS.md compliance section,
how-to-verify, and a Context → Model → Prompt AI-usage breakdown. Embed the 5 screenshots.
Base `main` ← `homework-6-submission` (personal fork only). Assign reviewer **Alexey-Popov**,
add label `homework-6`.

---

## Self-review (spec coverage)

- Task 1 (Agent 1): specification.md (6.1), agents.md (6.2), write-spec skill (5.4) ✅
- Task 2 (Agent 2): 3 agents (2.1–2.3), integrator + shared protocol (3.1–3.2), research-notes (4.1) ✅
- Task 3 (Agent 3): run-pipeline + validate-transactions skills (5.4), coverage gate settings.json + pre-push (5.3) ✅
- Task 4 (MCP): mcp.json + context7 (4.1, 4.3), custom server handlers + wiring (4.2–4.3) ✅
- Task 5 (Agent 4): tests throughout + integration (3.2), README (7.1), HOWTORUN (7.2), 5 screenshots (7.3) ✅
- "All transactions → shared/results/" verified by integration test (3.2) ✅
- Coverage gate blocks < 80%, target ≥ 90% (5.2, 5.3, 8.1) ✅
```
