import type { Classification, Category, Priority } from './models/ticket';

const PRIORITY_RULES: Array<{ priority: Priority; keywords: string[] }> = [
  { priority: 'urgent', keywords: ["can't access", 'cannot access', 'critical', 'production down', 'security'] },
  { priority: 'high', keywords: ['important', 'blocking', 'asap'] },
  { priority: 'low', keywords: ['minor', 'cosmetic', 'suggestion', 'suggestions'] },
];

const CATEGORY_RULES: Array<{ category: Category; keywords: string[] }> = [
  { category: 'account_access', keywords: ['login', 'password', '2fa', 'sign in', 'signin', 'locked out'] },
  { category: 'technical_issue', keywords: ['error', 'crash', 'exception', 'not working', 'broken'] },
  { category: 'billing_question', keywords: ['payment', 'invoice', 'refund', 'charge', 'subscription'] },
  { category: 'feature_request', keywords: ['feature request', 'would be nice', 'could you add', 'enhancement', 'suggestion', 'suggestions'] },
  { category: 'bug_report', keywords: ['bug', 'reproduce', 'steps to reproduce', 'regression'] },
];

function matchKeywords(text: string, keywords: string[]): string[] {
  const lower = text.toLowerCase();
  const matched: string[] = [];
  for (const kw of keywords) {
    if (lower.includes(kw) && !matched.includes(kw)) {
      matched.push(kw);
    }
  }
  return matched;
}

export function classify(subject: string, description: string): Classification {
  const combined = `${subject} ${description}`;

  // Priority: walk rules in order, first match wins
  let priority: Priority = 'medium';
  for (const rule of PRIORITY_RULES) {
    if (matchKeywords(combined, rule.keywords).length > 0) {
      priority = rule.priority;
      break;
    }
  }

  // Category: pick category with most keyword matches, tie-break by listed order
  let category: Category = 'other';
  let bestCount = 0;
  const allMatchedKeywords: string[] = [];

  for (const rule of CATEGORY_RULES) {
    const matched = matchKeywords(combined, rule.keywords);
    if (matched.length > bestCount) {
      bestCount = matched.length;
      category = rule.category;
      allMatchedKeywords.length = 0;
      allMatchedKeywords.push(...matched);
    }
  }

  // Deduplicate keywords preserving order
  const keywords = [...new Set(allMatchedKeywords)];

  const confidence = keywords.length === 0 ? 0.3 : Math.min(1, keywords.length / 3);

  const reasoning =
    keywords.length === 0
      ? 'No matching keywords found; defaulting to other/medium.'
      : `Matched keywords: ${keywords.join(', ')}. Category: ${category}, Priority: ${priority}.`;

  return {
    category,
    priority,
    confidence,
    reasoning,
    keywords,
    classified_at: new Date().toISOString(),
  };
}