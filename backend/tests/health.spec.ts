import request from 'supertest';
import { createApp } from '../src/app.js';

describe('GET /api/v1/health', () => {
  const app = createApp();

  it('should return a healthy standard ApiResponse envelope', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.body).toHaveProperty('statusCode', 200);
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('status', 'healthy');
    expect(res.body.data).toHaveProperty('version', '1.0.0');
    expect(res.body).toHaveProperty('meta');
    expect(res.body.meta).toHaveProperty('timestamp');
  });

  it('should return 404 for unknown route', async () => {
    const res = await request(app).get('/api/v1/unknown-endpoint-12345');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('statusCode', 404);
    expect(res.body.error).toHaveProperty('code', 'NOT_FOUND');
  });
});
