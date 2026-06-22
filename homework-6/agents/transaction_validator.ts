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
    const value = (d as unknown as Record<string, unknown>)[field];
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
