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
