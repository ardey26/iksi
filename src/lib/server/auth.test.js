import { describe, it, expect, vi, beforeAll } from 'vitest';
import bcrypt from 'bcrypt';

// Generate test password hash synchronously at module level
const testPasswordHash = await bcrypt.hash('test-password', 10);

// Mock the environment module before importing auth
vi.mock('$env/static/private', () => ({
	SECRET_KEY: 'test-secret-key-that-is-32-chars!',
	ADMIN_PASSWORD_HASH: testPasswordHash
}));

// Now import the auth module with the mocked env
const { createSession, verifySession, verifyPassword } = await import('./auth.js');

describe('createSession', () => {
	it('returns a session token in format sessionId.signature', () => {
		const token = createSession();
		expect(token).toMatch(/^[a-f0-9]{64}\.[a-f0-9]{64}$/);
	});

	it('returns different tokens on each call', () => {
		const token1 = createSession();
		const token2 = createSession();
		expect(token1).not.toBe(token2);
	});
});

describe('verifySession', () => {
	it('returns true for valid session token', () => {
		const token = createSession();
		expect(verifySession(token)).toBe(true);
	});

	it('returns false for tampered session id', () => {
		const token = createSession();
		const [, signature] = token.split('.');
		const tamperedId = 'a'.repeat(64);
		expect(verifySession(`${tamperedId}.${signature}`)).toBe(false);
	});

	it('returns false for tampered signature', () => {
		const token = createSession();
		const [sessionId] = token.split('.');
		const tamperedSig = 'b'.repeat(64);
		expect(verifySession(`${sessionId}.${tamperedSig}`)).toBe(false);
	});

	it('returns false for malformed token', () => {
		expect(verifySession('not-a-valid-token')).toBe(false);
		expect(verifySession('')).toBe(false);
		expect(verifySession(null)).toBe(false);
		expect(verifySession(undefined)).toBe(false);
	});
});

describe('verifyPassword', () => {
	it('returns true for correct password', async () => {
		const result = await verifyPassword('test-password');
		expect(result).toBe(true);
	});

	it('returns false for incorrect password', async () => {
		const result = await verifyPassword('wrong-password');
		expect(result).toBe(false);
	});

	it('returns false for empty password', async () => {
		const result = await verifyPassword('');
		expect(result).toBe(false);
	});
});
