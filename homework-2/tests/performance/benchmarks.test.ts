import fs from 'fs';
import path from 'path';
import request from 'supertest';
import app from '../../src/app';
import { classify } from '../../src/classifier';
import { clearStore } from '../../src/store/ticketStore';

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, '../fixtures', name));

beforeEach(() => clearStore());

describe('lightweight benchmarks', () => {
  test('handles 25 concurrent creates', async () => {
    const startedAt = Date.now();
    const responses = await Promise.all(
      Array.from({ length: 25 }, (_, index) => request(app).post('/tickets').send({
        customer_id: `bench-${index + 1}`,
        customer_email: `bench${index + 1}@example.com`,
        customer_name: `Bench ${index + 1}`,
        subject: `Login issue ${index + 1}`,
        description: `Cannot login to account after password reset attempt ${index + 1}.`,
        metadata: { source: 'web_form', browser: 'Chrome 120', device_type: 'desktop' },
      }))
    );
    const durationMs = Date.now() - startedAt;

    expect(responses).toHaveLength(25);
    expect(responses.every((response) => response.status === 201)).toBe(true);
    expect(new Set(responses.map((response) => response.body.id)).size).toBe(25);
    expect(durationMs).toBeLessThan(3000);
  });

  test('imports 50-ticket CSV fixture quickly', async () => {
    const startedAt = Date.now();
    const res = await request(app)
      .post('/tickets/import?auto_classify=true')
      .attach('file', fixture('sample_tickets.csv'), 'sample_tickets.csv');
    const durationMs = Date.now() - startedAt;

    expect(res.status).toBe(200);
    expect(res.body.successful).toBe(50);
    expect(res.body.classified).toBe(50);
    expect(durationMs).toBeLessThan(3000);
  });

  test('imports 20-ticket JSON fixture quickly', async () => {
    const startedAt = Date.now();
    const res = await request(app)
      .post('/tickets/import?auto_classify=true')
      .attach('file', fixture('sample_tickets.json'), 'sample_tickets.json');
    const durationMs = Date.now() - startedAt;

    expect(res.status).toBe(200);
    expect(res.body.successful).toBe(20);
    expect(res.body.classified).toBe(20);
    expect(durationMs).toBeLessThan(3000);
  });

  test('imports 30-ticket XML fixture quickly', async () => {
    const startedAt = Date.now();
    const res = await request(app)
      .post('/tickets/import?auto_classify=true')
      .attach('file', fixture('sample_tickets.xml'), 'sample_tickets.xml');
    const durationMs = Date.now() - startedAt;

    expect(res.status).toBe(200);
    expect(res.body.successful).toBe(30);
    expect(res.body.classified).toBe(30);
    expect(durationMs).toBeLessThan(3000);
  });

  test('filters imported tickets with combined category and priority efficiently', async () => {
    await request(app)
      .post('/tickets/import?auto_classify=true')
      .attach('file', fixture('sample_tickets.csv'), 'sample_tickets.csv');

    const startedAt = Date.now();
    const res = await request(app).get('/tickets?category=account_access&priority=medium');
    const durationMs = Date.now() - startedAt;

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);
    expect(durationMs).toBeLessThan(1000);
  });

  test('runs many classifier calls quickly', () => {
    const startedAt = Date.now();

    for (let index = 0; index < 500; index += 1) {
      const result = classify(
        `Critical login error ${index}`,
        `Cannot login, production down, security issue, invoice question ${index}.`
      );
      expect(result.category).toBeDefined();
      expect(result.priority).toBeDefined();
    }

    const durationMs = Date.now() - startedAt;
    expect(durationMs).toBeLessThan(1000);
  });
});
