import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('GET /health/live', () => {
  it('answers ok and is never cached', async () => {
    const response = GET();

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).toBe('ok');
  });
});
