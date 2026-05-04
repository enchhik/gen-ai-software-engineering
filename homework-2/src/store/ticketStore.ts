import { randomUUID } from 'crypto';
import type { Ticket, CreateTicketInput, UpdateTicketInput, Classification, Category, Priority, Status } from '../models/ticket';

export type InternalUpdateInput = UpdateTicketInput & { last_classification?: Classification | null };

const store = new Map<string, Ticket>();

export interface TicketFilters {
  category?: Category;
  priority?: Priority;
  status?: Status;
  assigned_to?: string;
}

export function createTicket(input: CreateTicketInput): Ticket {
  const now = new Date().toISOString();
  const ticket: Ticket = {
    id: randomUUID(),
    customer_id: input.customer_id,
    customer_email: input.customer_email,
    customer_name: input.customer_name,
    subject: input.subject,
    description: input.description,
    category: input.category,
    priority: input.priority,
    status: input.status,
    created_at: now,
    updated_at: now,
    resolved_at: input.status === 'resolved' ? now : null,
    assigned_to: input.assigned_to,
    tags: input.tags,
    metadata: input.metadata,
    last_classification: null,
  };
  store.set(ticket.id, ticket);
  return ticket;
}

export function getTicket(id: string): Ticket | undefined {
  return store.get(id);
}

export function listTickets(filters: TicketFilters = {}): Ticket[] {
  let tickets = Array.from(store.values());
  if (filters.category !== undefined) tickets = tickets.filter((t) => t.category === filters.category);
  if (filters.priority !== undefined) tickets = tickets.filter((t) => t.priority === filters.priority);
  if (filters.status !== undefined) tickets = tickets.filter((t) => t.status === filters.status);
  if (filters.assigned_to !== undefined) tickets = tickets.filter((t) => t.assigned_to === filters.assigned_to);
  return tickets;
}

export function updateTicket(id: string, input: InternalUpdateInput): Ticket | undefined {
  const existing = store.get(id);
  if (!existing) return undefined;

  const now = new Date().toISOString();
  const newStatus = input.status ?? existing.status;

  let resolved_at = existing.resolved_at;
  if (newStatus === 'resolved' && existing.status !== 'resolved') {
    resolved_at = now;
  } else if (newStatus !== 'resolved' && existing.status === 'resolved') {
    resolved_at = null;
  }

  const updated: Ticket = {
    ...existing,
    ...input,
    status: newStatus,
    resolved_at,
    updated_at: now,
    created_at: existing.created_at,
    last_classification: 'last_classification' in input
      ? (input.last_classification ?? null)
      : existing.last_classification,
  };
  store.set(id, updated);
  return updated;
}

export function deleteTicket(id: string): boolean {
  return store.delete(id);
}

export function clearStore(): void {
  store.clear();
}