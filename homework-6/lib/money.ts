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
