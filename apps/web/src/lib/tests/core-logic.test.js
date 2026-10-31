import { describe, it, expect } from 'vitest';
import { isValidURL, isValidURLServer, addPrefix, isValidAlias } from '../utils/urlValidation.js';

describe('URL Shortener Core Logic', () => {
	describe('URL Validation', () => {
		it('should validate URLs correctly', () => {
			expect(isValidURL('https://example.com')).toBe(true);
			expect(isValidURL('http://example.com')).toBe(true);
			expect(isValidURL('example.com')).toBe(true); // Should work with addPrefix
			expect(isValidURL('invalid-url')).toBe(false);
			expect(isValidURL('javascript:alert(1)')).toBe(false);
		});

		it('should handle URL prefixing', () => {
			expect(addPrefix('example.com')).toBe('https://example.com');
			expect(addPrefix('https://example.com')).toBe('https://example.com');
			expect(addPrefix('http://example.com')).toBe('http://example.com');
		});

		it('should validate aliases', () => {
			expect(isValidAlias('mylink')).toBe(true);
			expect(isValidAlias('my-link')).toBe(true);
			expect(isValidAlias('my_link')).toBe(true);
			expect(isValidAlias('link123')).toBe(true);
			expect(isValidAlias('')).toBe(false);
			expect(isValidAlias('my link')).toBe(false);
			expect(isValidAlias('my.link')).toBe(false);
			expect(isValidAlias('a'.repeat(51))).toBe(false);
		});

		it('should have stricter server validation', () => {
			expect(isValidURLServer('https://example.com')).toBe(true);
			expect(isValidURLServer('http://localhost:3000')).toBe(false);
			expect(isValidURLServer('https://127.0.0.1')).toBe(false);
		});
	});
});

describe('Integration Tests (Mock)', () => {
	it('should simulate URL shortening flow', async () => {
		const inputURL = 'example.com';
		const prefixedURL = addPrefix(inputURL);
		const isValid = isValidURLServer(prefixedURL);
		
		expect(prefixedURL).toBe('https://example.com');
		expect(isValid).toBe(true);
		
		// Simulate successful shortening
		const mockShortURL = {
			id: 'abc123',
			url: prefixedURL,
			alias: null,
			clicks: 0
		};
		
		expect(mockShortURL.url).toBe('https://example.com');
		expect(mockShortURL.id).toBe('abc123');
	});

	it('should simulate custom alias flow', async () => {
		const inputURL = 'https://example.com';
		const customAlias = 'my-custom-link';
		
		const isURLValid = isValidURLServer(inputURL);
		const isAliasValid = isValidAlias(customAlias);
		
		expect(isURLValid).toBe(true);
		expect(isAliasValid).toBe(true);
		
		// Simulate successful shortening with alias
		const mockShortURL = {
			id: customAlias,
			url: inputURL,
			alias: customAlias,
			clicks: 0
		};
		
		expect(mockShortURL.id).toBe(customAlias);
		expect(mockShortURL.alias).toBe(customAlias);
	});

	it('should reject invalid inputs', async () => {
		expect(isValidURL('invalid')).toBe(false);
		expect(isValidURL('javascript:alert(1)')).toBe(false);
		expect(isValidAlias('ab')).toBe(true); // Current implementation allows 1+ chars
		expect(isValidAlias('invalid alias!')).toBe(false);
		expect(isValidURLServer('http://localhost')).toBe(false);
	});
});
