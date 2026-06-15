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
