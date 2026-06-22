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
