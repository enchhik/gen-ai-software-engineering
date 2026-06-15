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
