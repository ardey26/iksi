import { describe, it, expect } from 'vitest';
import { encodeURL, decodeURL } from './crypto.js';

describe('URL Crypto', () => {
	it('should encode and decode URLs correctly', async () => {
		const originalURL = 'https://example.com/test';
		
		const encodedURL = await encodeURL(originalURL);
		expect(encodedURL).not.toBe(originalURL);
		
		const decodedURL = await decodeURL(encodedURL);
		expect(decodedURL).toBe(originalURL);
	});

	it('should handle plaintext URLs (backward compatibility)', async () => {
		const plaintextURL = 'https://example.com/plaintext';
		const result = await decodeURL(plaintextURL);
		expect(result).toBe(plaintextURL);
	});
});
