import { classify } from '../../src/classifier';

describe('classify - priority rules', () => {
  test('returns urgent for "critical" keyword', () => {
    const result = classify('Critical issue', 'The system is down.');
    expect(result.priority).toBe('urgent');
  });

  test('returns urgent for "production down" in description', () => {
    const result = classify('Help', 'production down right now');
    expect(result.priority).toBe('urgent');
  });

  test('returns urgent for "security" keyword', () => {
    const result = classify('Security vulnerability found', 'Details inside.');
    expect(result.priority).toBe('urgent');
  });

  test('returns high for "blocking" keyword', () => {
    const result = classify('This is blocking our release', 'Please help asap.');
    expect(result.priority).toBe('high');
  });

  test('returns high for "important" keyword', () => {
    const result = classify('Important billing issue', 'Payment failed.');
    expect(result.priority).toBe('high');
  });

  test('returns low for "minor" keyword', () => {
    const result = classify('Minor display glitch', 'The button is slightly misaligned.');
    expect(result.priority).toBe('low');
  });

  test('returns low for "cosmetic" keyword', () => {
    const result = classify('Cosmetic issue', 'Wrong font color.');
    expect(result.priority).toBe('low');
  });

  test('returns medium when no priority keyword matches', () => {
    const result = classify('Password reset broken', 'I cannot reset my password.');
    expect(result.priority).toBe('medium');
  });

  test('urgent takes precedence over high', () => {
    const result = classify('Critical and important', 'blocking and security issue');
    expect(result.priority).toBe('urgent');
  });
});

describe('classify - category rules', () => {
  test('detects account_access from "login"', () => {
    const result = classify('Login fails', 'I cannot login to my account.');
    expect(result.category).toBe('account_access');
  });

  test('detects account_access from "password"', () => {
    const result = classify('Password issue', 'Reset password does not work.');
    expect(result.category).toBe('account_access');
  });

  test('detects account_access from "locked out"', () => {
    const result = classify('Locked out', 'I am locked out of my account.');
    expect(result.category).toBe('account_access');
  });

  test('detects technical_issue from "error"', () => {
    const result = classify('Error loading page', 'Getting an error when I open the app.');
    expect(result.category).toBe('technical_issue');
  });

  test('detects technical_issue from "crash"', () => {
    const result = classify('App crash', 'The app crashes on startup.');
    expect(result.category).toBe('technical_issue');
  });

  test('detects billing_question from "invoice"', () => {
    const result = classify('Invoice missing', 'I did not receive my invoice.');
    expect(result.category).toBe('billing_question');
  });

  test('detects billing_question from "refund"', () => {
    const result = classify('Request a refund', 'I want a refund for my subscription.');
    expect(result.category).toBe('billing_question');
  });

  test('detects feature_request from "enhancement"', () => {
    const result = classify('Enhancement needed', 'Would be nice to have dark mode.');
    expect(result.category).toBe('feature_request');
  });

  test('detects feature_request from "could you add"', () => {
    const result = classify('New feature', 'Could you add export to PDF?');
    expect(result.category).toBe('feature_request');
  });

  test('detects bug_report from "bug"', () => {
    const result = classify('Found a bug', 'There is a bug in the checkout flow.');
    expect(result.category).toBe('bug_report');
  });

  test('detects bug_report from "regression"', () => {
    const result = classify('Regression in v2', 'This worked before, now it is a regression.');
    expect(result.category).toBe('bug_report');
  });

  test('returns other when no category keyword matches', () => {
    const result = classify('Hello', 'I have a general question about the service.');
    expect(result.category).toBe('other');
  });

  test('tie-break: account_access wins over technical_issue when equal matches', () => {
    const result = classify('login error', 'login error');
    expect(result.category).toBe('account_access');
  });
});

describe('classify - suggestion keyword', () => {
  test('"suggestion" maps to feature_request', () => {
    const result = classify('A suggestion', 'Just a minor suggestion for the UI.');
    expect(result.category).toBe('feature_request');
  });

  test('"suggestion" also maps to low priority', () => {
    const result = classify('A suggestion', 'Just a minor suggestion for the UI.');
    expect(result.priority).toBe('low');
  });
});

describe('classify - confidence', () => {
  test('confidence is 0.3 when no keywords match', () => {
    const result = classify('Hello', 'I have a general question about the service.');
    expect(result.confidence).toBe(0.3);
  });

  test('confidence is 1/3 for one unique keyword match', () => {
    const result = classify('login issue', 'I need help.');
    expect(result.confidence).toBeCloseTo(1 / 3);
  });

  test('confidence reaches 1 with 3 or more unique keyword matches', () => {
    const result = classify('login password locked out', 'Cannot sign in.');
    expect(result.confidence).toBe(1);
  });

  test('confidence does not exceed 1', () => {
    const result = classify('login password locked out signin 2fa', 'Cannot sign in.');
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});

describe('classify - keywords', () => {
  test('matched keywords are returned', () => {
    const result = classify('login issue', 'Password problem.');
    expect(result.keywords).toContain('login');
    expect(result.keywords).toContain('password');
  });

  test('duplicate keyword occurrences are deduplicated', () => {
    const result = classify('login login login', 'login problem');
    const loginCount = result.keywords.filter((k) => k === 'login').length;
    expect(loginCount).toBe(1);
  });

  test('keywords list is empty when no matches', () => {
    const result = classify('Hello', 'General question about the service here.');
    expect(result.keywords).toEqual([]);
  });
});

describe('classify - output shape', () => {
  test('result contains all required fields', () => {
    const result = classify('Login issue', 'Cannot login to my account.');
    expect(result).toHaveProperty('category');
    expect(result).toHaveProperty('priority');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('reasoning');
    expect(result).toHaveProperty('keywords');
    expect(result).toHaveProperty('classified_at');
    expect(typeof result.reasoning).toBe('string');
    expect(result.reasoning.length).toBeGreaterThan(0);
    expect(typeof result.classified_at).toBe('string');
  });
});
