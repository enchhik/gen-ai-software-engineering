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
