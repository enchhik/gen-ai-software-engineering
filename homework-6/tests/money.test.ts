import { parseAmount, isPositiveAmount, calcFee, calcNet } from '../lib/money';

describe('money', () => {
  it('parses valid decimal strings', () => {
    expect(parseAmount('1500.00')?.toFixed(2)).toBe('1500.00');
  });
  it('returns null for non-finite/garbage', () => {
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('')).toBeNull();
  });
  it('detects positive amounts', () => {
    expect(isPositiveAmount('1500.00')).toBe(true);
    expect(isPositiveAmount('-100.00')).toBe(false);
    expect(isPositiveAmount('0')).toBe(false);
    expect(isPositiveAmount('abc')).toBe(false);
  });
  it('computes fee with ROUND_HALF_UP at 2dp', () => {
    expect(calcFee('1500.00')).toBe('7.50');
    expect(calcFee('9999.99')).toBe('50.00'); // 49.99995 -> 50.00
    expect(calcFee('3200.00')).toBe('16.00');
  });
  it('computes net = amount - fee', () => {
    expect(calcNet('1500.00', '7.50')).toBe('1492.50');
    expect(calcNet('9999.99', '50.00')).toBe('9949.99');
  });
});
