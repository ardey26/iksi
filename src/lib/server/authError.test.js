import { describe, it, expect } from 'vitest';
import { authError } from './authError.js';

describe('authError', () => {
  it('returns a Response with correct status and JSON body', async () => {
    const res = authError('UNAUTHORIZED', 'Session has expired', 401);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: 'UNAUTHORIZED', message: 'Session has expired' }
    });
    expect(res.headers.get('Content-Type')).toBe('application/json');
  });

  it('defaults to 400 status', async () => {
    const res = authError('VALIDATION_ERROR', 'Bad input');
    expect(res.status).toBe(400);
  });
});
