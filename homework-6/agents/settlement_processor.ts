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
