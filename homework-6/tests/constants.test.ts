import { ISO_4217, isValidCurrency, AGENTS, STATUS } from '../lib/constants';

describe('constants', () => {
  it('accepts known ISO 4217 codes', () => {
    expect(isValidCurrency('USD')).toBe(true);
    expect(isValidCurrency('EUR')).toBe(true);
    expect(isValidCurrency('GBP')).toBe(true);
    expect(isValidCurrency('JPY')).toBe(true);
  });
  it('rejects unknown codes', () => {
    expect(isValidCurrency('XYZ')).toBe(false);
    expect(isValidCurrency('')).toBe(false);
  });
  it('exposes agent names and statuses', () => {
    expect(AGENTS.VALIDATOR).toBe('transaction_validator');
    expect(STATUS.SETTLED).toBe('settled');
    expect(ISO_4217.has('USD')).toBe(true);
  });
});
