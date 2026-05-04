// @ts-ignore
import request from 'supertest';
import app from '../../src/app';
import { clearStore } from '../../src/store/ticketStore';

beforeEach(() => clearStore());

const valid = {
  customer_id: 'cust-1',
  customer_email: 'alice@example.com',
  customer_name: 'Alice',
  subject: 'Login issue',
  description: 'I cannot login to my account for several days.',
  metadata: { source: 'web_form', browser: 'Chrome 120', device_type: 'desktop' },
};

// ─── POST /tickets ────────────────────────────────────────────────────────────

describe('POST /tickets', () => {
  test('returns 201 with created ticket', async () => {
    const res = await request(app).post('/tickets').send(valid);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.customer_email).toBe('alice@example.com');
    expect(res.body.status).toBe('new');
    expect(res.body.category).toBe('other');
    expect(res.body.priority).toBe('medium');
  });

  test('sets server-managed fields', async () => {
    const res = await request(app).post('/tickets').send(valid);
    expect(res.body.created_at).toBeDefined();
    expect(res.body.updated_at).toBeDefined();
    expect(res.body.resolved_at).toBeNull();
    expect(res.body.last_classification).toBeNull();
  });

  test('returns 400 for missing required fields', async () => {
    const res = await request(app).post('/tickets').send({ customer_email: 'x@x.com' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 400 for invalid email', async () => {
    const res = await request(app).post('/tickets').send({ ...valid, customer_email: 'bad' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('returns 400 for subject too long', async () => {
    const res = await request(app).post('/tickets').send({ ...valid, subject: 'x'.repeat(201) });
    expect(res.status).toBe(400);
  });

  test('?auto_classify=true sets last_classification and updates category/priority', async () => {
    const res = await request(app)
      .post('/tickets?auto_classify=true')
      .send({ ...valid, subject: 'Critical login error', description: 'Cannot login, critical production down issue.' });
    expect(res.status).toBe(201);
    expect(res.body.last_classification).not.toBeNull();
    expect(res.body.last_classification.category).toBeDefined();
    expect(res.body.last_classification.priority).toBeDefined();
    expect(res.body.category).toBe(res.body.last_classification.category);
    expect(res.body.priority).toBe(res.body.last_classification.priority);
  });
});

// ─── GET /tickets ─────────────────────────────────────────────────────────────

describe('GET /tickets', () => {
  test('returns empty array when store is empty', async () => {
    const res = await request(app).get('/tickets');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns all tickets', async () => {
    await request(app).post('/tickets').send(valid);
    await request(app).post('/tickets').send({ ...valid, customer_email: 'bob@example.com' });
    const res = await request(app).get('/tickets');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  test('filters by category', async () => {
    await request(app).post('/tickets').send(valid);
    await request(app).post('/tickets').send({ ...valid, customer_email: 'b@b.com', category: 'billing_question' });
    const res = await request(app).get('/tickets?category=billing_question');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].category).toBe('billing_question');
  });

  test('filters by priority', async () => {
    await request(app).post('/tickets').send(valid);
    await request(app).post('/tickets').send({ ...valid, customer_email: 'b@b.com', priority: 'urgent' });
    const res = await request(app).get('/tickets?priority=urgent');
    expect(res.body.length).toBe(1);
    expect(res.body[0].priority).toBe('urgent');
  });

  test('filters by status', async () => {
    await request(app).post('/tickets').send(valid);
    await request(app).post('/tickets').send({ ...valid, customer_email: 'b@b.com', status: 'closed' });
    const res = await request(app).get('/tickets?status=closed');
    expect(res.body.length).toBe(1);
    expect(res.body[0].status).toBe('closed');
  });

  test('filters by assigned_to', async () => {
    await request(app).post('/tickets').send(valid);
    await request(app).post('/tickets').send({ ...valid, customer_email: 'b@b.com', assigned_to: 'agent-7' });
    const res = await request(app).get('/tickets?assigned_to=agent-7');
    expect(res.body.length).toBe(1);
    expect(res.body[0].assigned_to).toBe('agent-7');
  });
});

// ─── GET /tickets/:id ────────────────────────────────────────────────────────

describe('GET /tickets/:id', () => {
  test('returns ticket by id', async () => {
    const created = await request(app).post('/tickets').send(valid);
    const res = await request(app).get(`/tickets/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).get('/tickets/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ─── PUT /tickets/:id ────────────────────────────────────────────────────────

describe('PUT /tickets/:id', () => {
  test('updates supplied fields and returns 200', async () => {
    const created = await request(app).post('/tickets').send(valid);
    const res = await request(app)
      .put(`/tickets/${created.body.id}`)
      .send({ subject: 'Updated subject' });
    expect(res.status).toBe(200);
    expect(res.body.subject).toBe('Updated subject');
  });

  test('refreshes updated_at', async () => {
    const created = await request(app).post('/tickets').send(valid);
    await new Promise((r) => setTimeout(r, 5));
    const res = await request(app)
      .put(`/tickets/${created.body.id}`)
      .send({ priority: 'high' });
    expect(res.body.updated_at).not.toBe(created.body.updated_at);
  });

  test('allows manual category override', async () => {
    const created = await request(app).post('/tickets').send(valid);
    const res = await request(app)
      .put(`/tickets/${created.body.id}`)
      .send({ category: 'billing_question' });
    expect(res.body.category).toBe('billing_question');
  });

  test('allows manual priority override', async () => {
    const created = await request(app).post('/tickets').send(valid);
    const res = await request(app)
      .put(`/tickets/${created.body.id}`)
      .send({ priority: 'urgent' });
    expect(res.body.priority).toBe('urgent');
  });

  test('setting status to resolved sets resolved_at', async () => {
    const created = await request(app).post('/tickets').send(valid);
    const res = await request(app)
      .put(`/tickets/${created.body.id}`)
      .send({ status: 'resolved' });
    expect(res.body.resolved_at).not.toBeNull();
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).put('/tickets/no-such-id').send({ subject: 'x' });
    expect(res.status).toBe(404);
  });

  test('returns 400 for invalid field value', async () => {
    const created = await request(app).post('/tickets').send(valid);
    const res = await request(app)
      .put(`/tickets/${created.body.id}`)
      .send({ priority: 'extreme' });
    expect(res.status).toBe(400);
  });
});

// ─── DELETE /tickets/:id ─────────────────────────────────────────────────────

describe('DELETE /tickets/:id', () => {
  test('returns 204 and removes the ticket', async () => {
    const created = await request(app).post('/tickets').send(valid);
    const del = await request(app).delete(`/tickets/${created.body.id}`);
    expect(del.status).toBe(204);
    const get = await request(app).get(`/tickets/${created.body.id}`);
    expect(get.status).toBe(404);
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).delete('/tickets/no-such-id');
    expect(res.status).toBe(404);
  });
});

// ─── POST /tickets/:id/auto-classify ─────────────────────────────────────────

describe('POST /tickets/:id/auto-classify', () => {
  test('returns 200 with { ticket, classification }', async () => {
    const created = await request(app).post('/tickets').send(valid);
    const res = await request(app).post(`/tickets/${created.body.id}/auto-classify`);
    expect(res.status).toBe(200);
    expect(res.body.ticket).toBeDefined();
    expect(res.body.classification).toBeDefined();
  });

  test('updates ticket category and priority from classification', async () => {
    const created = await request(app).post('/tickets').send({
      ...valid,
      subject: 'Critical production down',
      description: 'Production is completely down and security is compromised.',
    });
    const res = await request(app).post(`/tickets/${created.body.id}/auto-classify`);
    expect(res.body.ticket.category).toBe(res.body.classification.category);
    expect(res.body.ticket.priority).toBe(res.body.classification.priority);
    expect(res.body.ticket.last_classification).not.toBeNull();
  });

  test('classification has required fields', async () => {
    const created = await request(app).post('/tickets').send(valid);
    const res = await request(app).post(`/tickets/${created.body.id}/auto-classify`);
    const c = res.body.classification;
    expect(c.category).toBeDefined();
    expect(c.priority).toBeDefined();
    expect(typeof c.confidence).toBe('number');
    expect(typeof c.reasoning).toBe('string');
    expect(Array.isArray(c.keywords)).toBe(true);
    expect(c.classified_at).toBeDefined();
  });

  test('returns 404 for unknown id', async () => {
    const res = await request(app).post('/tickets/no-such-id/auto-classify');
    expect(res.status).toBe(404);
  });
});

// ─── POST /tickets/import ────────────────────────────────────────────────────

describe('POST /tickets/import', () => {
  const validCsv = `customer_id,customer_email,customer_name,subject,description,metadata.source,metadata.browser,metadata.device_type,tags
cust-1,alice@example.com,Alice,Login issue,I cannot login to my account for several days.,web_form,Chrome 120,desktop,billing;urgent
cust-2,bob@example.com,Bob,Billing question,I need help with my invoice payment today.,email,n/a,mobile,invoice`;

  const validJson = JSON.stringify([
    {
      customer_id: 'cust-1',
      customer_email: 'alice@example.com',
      customer_name: 'Alice',
      subject: 'Login issue',
      description: 'I cannot login to my account for several days.',
      metadata: { source: 'web_form', browser: 'Chrome 120', device_type: 'desktop' },
      tags: ['billing', 'urgent'],
    },
    {
      customer_id: 'cust-2',
      customer_email: 'bob@example.com',
      customer_name: 'Bob',
      subject: 'Billing question',
      description: 'I need help with my invoice payment today.',
      metadata: { source: 'email', browser: 'n/a', device_type: 'mobile' },
      tags: ['invoice'],
    },
  ]);

  const validXml = `<?xml version="1.0"?>
<tickets>
  <ticket>
    <customer_id>cust-1</customer_id>
    <customer_email>alice@example.com</customer_email>
    <customer_name>Alice</customer_name>
    <subject>Login issue</subject>
    <description>I cannot login to my account for several days.</description>
    <metadata>
      <source>web_form</source>
      <browser>Chrome 120</browser>
      <device_type>desktop</device_type>
    </metadata>
    <tags>
      <tag>billing</tag>
      <tag>urgent</tag>
    </tags>
  </ticket>
  <ticket>
    <customer_id>cust-2</customer_id>
    <customer_email>bob@example.com</customer_email>
    <customer_name>Bob</customer_name>
    <subject>Billing question</subject>
    <description>I need help with my invoice payment today.</description>
    <metadata>
      <source>email</source>
      <browser>n/a</browser>
      <device_type>mobile</device_type>
    </metadata>
    <tags>
      <tag>invoice</tag>
    </tags>
  </ticket>
</tickets>`;

  test('imports CSV and returns 200 summary', async () => {
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', Buffer.from(validCsv, 'utf-8'), 'tickets.csv');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      total: 2,
      successful: 2,
      classified: 0,
      failed: [],
    });

    const list = await request(app).get('/tickets');
    expect(list.body).toHaveLength(2);
  });

  test('imports JSON and returns 200 summary', async () => {
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', Buffer.from(validJson, 'utf-8'), 'tickets.json');

    expect(res.status).toBe(200);
    expect(res.body.successful).toBe(2);

    const list = await request(app).get('/tickets');
    expect(list.body).toHaveLength(2);
  });

  test('imports XML and returns 200 summary', async () => {
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', Buffer.from(validXml, 'utf-8'), 'tickets.xml');

    expect(res.status).toBe(200);
    expect(res.body.successful).toBe(2);

    const list = await request(app).get('/tickets');
    expect(list.body).toHaveLength(2);
  });

  test('returns 400 for malformed file', async () => {
    const malformedJson = '[{"customer_id":"cust-1"}';

    const res = await request(app)
      .post('/tickets/import')
      .attach('file', Buffer.from(malformedJson, 'utf-8'), 'tickets.json');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('returns 415 for unsupported file format', async () => {
    const res = await request(app)
      .post('/tickets/import')
      .attach('file', Buffer.from('plain text', 'utf-8'), 'tickets.txt');

    expect(res.status).toBe(415);
    expect(res.body.error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  test('returns 207 when some imported rows are invalid', async () => {
    const partialJson = JSON.stringify([
      {
        customer_id: 'cust-1',
        customer_email: 'alice@example.com',
        customer_name: 'Alice',
        subject: 'Login issue',
        description: 'I cannot login to my account for several days.',
        metadata: { source: 'web_form', browser: 'Chrome 120', device_type: 'desktop' },
        tags: ['billing'],
      },
      {
        customer_id: 'cust-2',
        customer_email: 'not-an-email',
        customer_name: 'Bob',
        subject: 'Billing question',
        description: 'I need help with my invoice payment today.',
        metadata: { source: 'email', browser: 'n/a', device_type: 'mobile' },
        tags: ['invoice'],
      },
    ]);

    const res = await request(app)
      .post('/tickets/import')
      .attach('file', Buffer.from(partialJson, 'utf-8'), 'tickets.json');

    expect(res.status).toBe(207);
    expect(res.body.total).toBe(2);
    expect(res.body.successful).toBe(1);
    expect(res.body.classified).toBe(0);
    expect(res.body.failed).toHaveLength(1);
    expect(res.body.failed[0].row).toBe(2);
    expect(res.body.failed[0].raw.customer_email).toBe('not-an-email');

    const list = await request(app).get('/tickets');
    expect(list.body).toHaveLength(1);
  });

  test('?auto_classify=true classifies successful imports and reports count', async () => {
    const res = await request(app)
      .post('/tickets/import?auto_classify=true')
      .attach('file', Buffer.from(validJson, 'utf-8'), 'tickets.json');

    expect(res.status).toBe(200);
    expect(res.body.classified).toBe(2);

    const list = await request(app).get('/tickets');
    expect(list.body).toHaveLength(2);
    expect(list.body[0].last_classification).not.toBeNull();
    expect(list.body[1].last_classification).not.toBeNull();
  });
});
