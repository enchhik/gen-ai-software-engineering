import {
  CreateTicketInputSchema,
  TicketSchema,
  CategoryEnum,
  PriorityEnum,
  StatusEnum,
} from '../../src/models/ticket';

const validInput = {
  customer_id: 'cust-1',
  customer_email: 'user@example.com',
  customer_name: 'Alice',
  subject: 'Cannot login',
  description: 'I have been unable to login for two days now.',
  metadata: {
    source: 'web_form' as const,
    browser: 'Chrome 120',
    device_type: 'desktop' as const,
  },
};

describe('CreateTicketInputSchema', () => {
  test('valid input with defaults applied', () => {
    const result = CreateTicketInputSchema.parse(validInput);
    expect(result.category).toBe('other');
    expect(result.priority).toBe('medium');
    expect(result.status).toBe('new');
    expect(result.assigned_to).toBeNull();
    expect(result.tags).toEqual([]);
  });

  test('invalid email fails', () => {
    expect(() =>
      CreateTicketInputSchema.parse({ ...validInput, customer_email: 'not-an-email' })
    ).toThrow();
  });

  test('subject too short (empty) fails', () => {
    expect(() =>
      CreateTicketInputSchema.parse({ ...validInput, subject: '' })
    ).toThrow();
  });

  test('subject too long (>200 chars) fails', () => {
    expect(() =>
      CreateTicketInputSchema.parse({ ...validInput, subject: 'a'.repeat(201) })
    ).toThrow();
  });

  test('description too short (<10 chars) fails', () => {
    expect(() =>
      CreateTicketInputSchema.parse({ ...validInput, description: 'short' })
    ).toThrow();
  });

  test('description too long (>2000 chars) fails', () => {
    expect(() =>
      CreateTicketInputSchema.parse({ ...validInput, description: 'a'.repeat(2001) })
    ).toThrow();
  });

  test('invalid category fails', () => {
    expect(() =>
      CreateTicketInputSchema.parse({ ...validInput, category: 'unknown_cat' })
    ).toThrow();
  });

  test('invalid priority fails', () => {
    expect(() =>
      CreateTicketInputSchema.parse({ ...validInput, priority: 'extreme' })
    ).toThrow();
  });

  test('invalid status fails', () => {
    expect(() =>
      CreateTicketInputSchema.parse({ ...validInput, status: 'pending' })
    ).toThrow();
  });

  test('missing metadata.browser fails', () => {
    const input = {
      ...validInput,
      metadata: { source: 'api' as const, device_type: 'desktop' as const },
    };
    expect(() => CreateTicketInputSchema.parse(input)).toThrow();
  });

  test('invalid metadata.device_type fails', () => {
    const input = {
      ...validInput,
      metadata: { ...validInput.metadata, device_type: 'smartwatch' },
    };
    expect(() => CreateTicketInputSchema.parse(input)).toThrow();
  });
});

describe('CategoryEnum', () => {
  test('contains all required values', () => {
    const values = CategoryEnum.options;
    expect(values).toContain('account_access');
    expect(values).toContain('technical_issue');
    expect(values).toContain('billing_question');
    expect(values).toContain('feature_request');
    expect(values).toContain('bug_report');
    expect(values).toContain('other');
  });
});

describe('PriorityEnum', () => {
  test('contains all required values', () => {
    const values = PriorityEnum.options;
    expect(values).toContain('urgent');
    expect(values).toContain('high');
    expect(values).toContain('medium');
    expect(values).toContain('low');
  });
});

describe('StatusEnum', () => {
  test('contains all required values', () => {
    const values = StatusEnum.options;
    expect(values).toContain('new');
    expect(values).toContain('in_progress');
    expect(values).toContain('waiting_customer');
    expect(values).toContain('resolved');
    expect(values).toContain('closed');
  });
});
