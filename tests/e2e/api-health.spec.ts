import { expect, test } from '@playwright/test';

const apiBaseURL = process.env.E2E_API_URL ?? 'http://127.0.0.1:3333/api';

test('API health endpoint responde sem autenticação', async ({ request }) => {
  const response = await request.get(`${apiBaseURL}/health`);

  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toMatch(/application\/json/);
  const body = await response.json();
  expect(body).toEqual(expect.objectContaining({ ok: true }));
  expect(typeof body.uptime).toBe('number');
  expect(typeof body.ts).toBe('string');
});
