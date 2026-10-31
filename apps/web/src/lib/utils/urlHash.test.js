import { describe, it, expect } from 'vitest';
import { createURLHash } from './urlHash.js';

describe('URL Hash', () => {
	it('should create consistent hashes for the same URL', async () => {
		const url = 'https://example.com/test';
		
		const hash1 = await createURLHash(url);
		const hash2 = await createURLHash(url);
		
		expect(hash1).toBe(hash2);
		expect(hash1).toBeTruthy();
		expect(typeof hash1).toBe('string');
	});

	it('should create different hashes for different URLs', async () => {
		const url1 = 'https://example.com/test1';
		const url2 = 'https://example.com/test2';
		
		const hash1 = await createURLHash(url1);
		const hash2 = await createURLHash(url2);
		
		expect(hash1).not.toBe(hash2);
	});

	it('should handle empty strings', async () => {
		const hash = await createURLHash('');
		expect(hash).toBeTruthy();
		expect(typeof hash).toBe('string');
	});

	it('should create 64-character hex hashes', async () => {
		const url = 'https://example.com/test';
		const hash = await createURLHash(url);
		
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});
});
