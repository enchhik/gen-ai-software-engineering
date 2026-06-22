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
