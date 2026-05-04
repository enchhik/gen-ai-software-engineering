import fs from 'fs';
import path from 'path';
import request from 'supertest';
import app from '../../src/app';
import { clearStore } from '../../src/store/ticketStore';

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, '../fixtures', name));

beforeEach(() => clearStore());

describe('ticket lifecycle scenarios', () => {
  test('supports full ticket lifecycle from create to delete', async () => {
    const createRes = await request(app).post('/tickets').send({
      customer_id: 'cust-life-1',
      customer_email: 'lifecycle@example.com',
      customer_name: 'Lifecycle User',
      subject: 'Login issue',
      description: 'Cannot login to account after password reset today.',
      metadata: { source: 'web_form', browser: 'Chrome 120', device_type: 'desktop' },
    });

    expect(createRes.status).toBe(201);

    const id = createRes.body.id;

    const getRes = await request(app).get(`/tickets/${id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(id);

    const updateRes = await request(app)
      .put(`/tickets/${id}`)
      .send({ status: 'resolved', assigned_to: 'agent-42' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('resolved');
    expect(updateRes.body.assigned_to).toBe('agent-42');
    expect(updateRes.body.resolved_at).not.toBeNull();

    const classifyRes = await request(app).post(`/tickets/${id}/auto-classify`);
    expect(classifyRes.status).toBe(200);
    expect(classifyRes.body.ticket.last_classification).not.toBeNull();
    expect(classifyRes.body.ticket.category).toBe('account_access');

    const deleteRes = await request(app).delete(`/tickets/${id}`);
    expect(deleteRes.status).toBe(204);

    const missingRes = await request(app).get(`/tickets/${id}`);
    expect(missingRes.status).toBe(404);
  });

  test('manual category/priority override persists; auto-classify updates last_classification but does not erase manual values', async () => {
    const createRes = await request(app).post('/tickets').send({
      customer_id: 'cust-override-1',
      customer_email: 'override@example.com',
      customer_name: 'Override User',
      subject: 'Payment question',
      description: 'I have a question about my invoice and subscription charge.',
      metadata: { source: 'email', browser: 'n/a', device_type: 'desktop' },
    });
    expect(createRes.status).toBe(201);
    const id = createRes.body.id;

    // manual override of category and priority
    const overrideRes = await request(app)
      .put(`/tickets/${id}`)
      .send({ category: 'feature_request', priority: 'low' });
    expect(overrideRes.status).toBe(200);
    expect(overrideRes.body.category).toBe('feature_request');
    expect(overrideRes.body.priority).toBe('low');
    expect(overrideRes.body.last_classification).toBeNull();

    // auto-classify updates category/priority and stores last_classification
    const classifyRes = await request(app).post(`/tickets/${id}/auto-classify`);
    expect(classifyRes.status).toBe(200);
    expect(classifyRes.body.ticket.last_classification).not.toBeNull();
    expect(classifyRes.body.ticket.category).toBe('billing_question');
    expect(classifyRes.body.classification.keywords.length).toBeGreaterThan(0);
  });

  test('JSON import with partial failure returns 207; only valid rows are stored', async () => {
    const validRow = {
      customer_id: 'json-1',
      customer_email: 'valid@example.com',
      customer_name: 'Valid User',
      subject: 'Error after login',
      description: 'Getting an exception when I try to login.',
      metadata: { source: 'web_form', browser: 'Chrome 120', device_type: 'desktop' },
    };
    const invalidRow = { customer_id: 'json-bad', customer_email: 'not-an-email' };

    const buf = Buffer.from(JSON.stringify([validRow, invalidRow]));
    const importRes = await request(app)
      .post('/tickets/import')
      .attach('file', buf, 'partial.json');

    expect(importRes.status).toBe(207);
    expect(importRes.body.total).toBe(2);
    expect(importRes.body.successful).toBe(1);
    expect(importRes.body.failed).toHaveLength(1);
    expect(importRes.body.failed[0].row).toBe(2);

    const listRes = await request(app).get('/tickets');
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].customer_email).toBe('valid@example.com');
  });

  test('XML import with auto-classification then filter by status new then update to in_progress', async () => {
    const importRes = await request(app)
      .post('/tickets/import?auto_classify=true')
      .attach('file', fixture('sample_tickets.xml'), 'sample_tickets.xml');

    expect(importRes.status).toBe(200);
    expect(importRes.body.successful).toBe(30);
    expect(importRes.body.classified).toBe(30);

    const newRes = await request(app).get('/tickets?status=new');
    expect(newRes.status).toBe(200);
    expect(newRes.body.length).toBeGreaterThan(0);
    expect(newRes.body.every((t: { status: string }) => t.status === 'new')).toBe(true);

    const targetId: string = newRes.body[0].id;
    const updateRes = await request(app)
      .put(`/tickets/${targetId}`)
      .send({ status: 'in_progress', assigned_to: 'agent-10' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.status).toBe('in_progress');
    expect(updateRes.body.resolved_at).toBeNull();
    expect(updateRes.body.assigned_to).toBe('agent-10');
  });

  test('imports fixture CSV with auto-classification and supports combined filters', async () => {
    const importRes = await request(app)
      .post('/tickets/import?auto_classify=true')
      .attach('file', fixture('sample_tickets.csv'), 'sample_tickets.csv');

    expect(importRes.status).toBe(200);
    expect(importRes.body).toEqual({
      total: 50,
      successful: 50,
      classified: 50,
      failed: [],
    });

    const listRes = await request(app).get('/tickets');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(50);
    expect(listRes.body.every((ticket: { last_classification: unknown }) => ticket.last_classification !== null)).toBe(true);

    const filteredRes = await request(app).get('/tickets?category=technical_issue&priority=medium');
    expect(filteredRes.status).toBe(200);
    expect(filteredRes.body).toHaveLength(10);
    expect(filteredRes.body.every((ticket: { category: string; priority: string }) => (
      ticket.category === 'technical_issue' && ticket.priority === 'medium'
    ))).toBe(true);
  });
});
