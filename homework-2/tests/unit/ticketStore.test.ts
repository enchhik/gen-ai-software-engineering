import {
  createTicket,
  getTicket,
  listTickets,
  updateTicket,
  deleteTicket,
  clearStore,
} from '../../src/store/ticketStore';
import type { CreateTicketInput, UpdateTicketInput } from '../../src/models/ticket';

const baseInput: CreateTicketInput = {
  customer_id: 'cust-1',
  customer_email: 'alice@example.com',
  customer_name: 'Alice',
  subject: 'Login issue',
  description: 'I cannot login to my account.',
  category: 'account_access',
  priority: 'medium',
  status: 'new',
  assigned_to: null,
  tags: [],
  metadata: { source: 'web_form', browser: 'Chrome 120', device_type: 'desktop' },
};

beforeEach(() => clearStore());

describe('createTicket', () => {
  test('generates a UUID id', () => {
    const ticket = createTicket(baseInput);
    expect(ticket.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  test('generates created_at and updated_at as ISO strings', () => {
    const ticket = createTicket(baseInput);
    expect(() => new Date(ticket.created_at)).not.toThrow();
    expect(() => new Date(ticket.updated_at)).not.toThrow();
  });

  test('created_at equals updated_at on creation', () => {
    const ticket = createTicket(baseInput);
    expect(ticket.created_at).toBe(ticket.updated_at);
  });

  test('resolved_at is null on creation', () => {
    const ticket = createTicket(baseInput);
    expect(ticket.resolved_at).toBeNull();
  });

  test('last_classification is null on creation', () => {
    const ticket = createTicket(baseInput);
    expect(ticket.last_classification).toBeNull();
  });

  test('stores all input fields', () => {
    const ticket = createTicket(baseInput);
    expect(ticket.customer_email).toBe('alice@example.com');
    expect(ticket.subject).toBe('Login issue');
    expect(ticket.category).toBe('account_access');
    expect(ticket.priority).toBe('medium');
    expect(ticket.status).toBe('new');
  });

  test('each created ticket gets a unique id', () => {
    const a = createTicket(baseInput);
    const b = createTicket(baseInput);
    expect(a.id).not.toBe(b.id);
  });
});

describe('getTicket', () => {
  test('returns ticket by id', () => {
    const ticket = createTicket(baseInput);
    expect(getTicket(ticket.id)).toEqual(ticket);
  });

  test('returns undefined for unknown id', () => {
    expect(getTicket('nonexistent')).toBeUndefined();
  });
});

describe('listTickets', () => {
  test('returns all tickets when no filters', () => {
    createTicket(baseInput);
    createTicket({ ...baseInput, customer_email: 'bob@example.com' });
    expect(listTickets().length).toBe(2);
  });

  test('returns empty array when store is empty', () => {
    expect(listTickets()).toEqual([]);
  });

  test('filters by category', () => {
    createTicket(baseInput);
    createTicket({ ...baseInput, customer_email: 'bob@example.com', category: 'billing_question' });
    const results = listTickets({ category: 'account_access' });
    expect(results.length).toBe(1);
    expect(results[0].category).toBe('account_access');
  });

  test('filters by priority', () => {
    createTicket(baseInput);
    createTicket({ ...baseInput, customer_email: 'bob@example.com', priority: 'urgent' });
    const results = listTickets({ priority: 'urgent' });
    expect(results.length).toBe(1);
    expect(results[0].priority).toBe('urgent');
  });

  test('filters by status', () => {
    createTicket(baseInput);
    createTicket({ ...baseInput, customer_email: 'bob@example.com', status: 'resolved' });
    const results = listTickets({ status: 'resolved' });
    expect(results.length).toBe(1);
    expect(results[0].status).toBe('resolved');
  });

  test('filters by assigned_to', () => {
    createTicket(baseInput);
    createTicket({ ...baseInput, customer_email: 'bob@example.com', assigned_to: 'agent-42' });
    const results = listTickets({ assigned_to: 'agent-42' });
    expect(results.length).toBe(1);
    expect(results[0].assigned_to).toBe('agent-42');
  });

  test('multiple filters are combined (AND)', () => {
    createTicket(baseInput);
    createTicket({ ...baseInput, customer_email: 'bob@example.com', category: 'billing_question', priority: 'urgent' });
    createTicket({ ...baseInput, customer_email: 'c@example.com', category: 'billing_question', priority: 'low' });
    const results = listTickets({ category: 'billing_question', priority: 'urgent' });
    expect(results.length).toBe(1);
  });
});

describe('updateTicket', () => {
  test('returns undefined for unknown id', () => {
    expect(updateTicket('nonexistent', { subject: 'x' })).toBeUndefined();
  });

  test('updates supplied fields', () => {
    const ticket = createTicket(baseInput);
    const updated = updateTicket(ticket.id, { subject: 'New subject' });
    expect(updated?.subject).toBe('New subject');
  });

  test('refreshes updated_at', async () => {
    const ticket = createTicket(baseInput);
    await new Promise((r) => setTimeout(r, 5));
    const updated = updateTicket(ticket.id, { priority: 'high' });
    expect(updated?.updated_at).not.toBe(ticket.updated_at);
  });

  test('does not change created_at', async () => {
    const ticket = createTicket(baseInput);
    await new Promise((r) => setTimeout(r, 5));
    const updated = updateTicket(ticket.id, { priority: 'high' });
    expect(updated?.created_at).toBe(ticket.created_at);
  });

  test('setting status to resolved sets resolved_at', () => {
    const ticket = createTicket(baseInput);
    const updated = updateTicket(ticket.id, { status: 'resolved' });
    expect(updated?.resolved_at).not.toBeNull();
    expect(typeof updated?.resolved_at).toBe('string');
  });

  test('changing status away from resolved clears resolved_at', () => {
    const ticket = createTicket(baseInput);
    updateTicket(ticket.id, { status: 'resolved' });
    const reopened = updateTicket(ticket.id, { status: 'in_progress' });
    expect(reopened?.resolved_at).toBeNull();
  });

  test('updating non-status fields does not change resolved_at when resolved', () => {
    const ticket = createTicket(baseInput);
    updateTicket(ticket.id, { status: 'resolved' });
    const updated = updateTicket(ticket.id, { priority: 'high' });
    expect(updated?.resolved_at).not.toBeNull();
  });
});

describe('deleteTicket', () => {
  test('returns true and removes ticket', () => {
    const ticket = createTicket(baseInput);
    expect(deleteTicket(ticket.id)).toBe(true);
    expect(getTicket(ticket.id)).toBeUndefined();
  });

  test('returns false for unknown id', () => {
    expect(deleteTicket('nonexistent')).toBe(false);
  });
});