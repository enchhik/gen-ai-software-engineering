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
