import { describe, it, expect } from 'vitest';
import { rateLimitsOff } from './rateLimit.js';

describe('rateLimitsOff', () => {
	it('is off only under vite dev', () => {
		expect(rateLimitsOff({ DEV: true, MODE: 'development' })).toBe(true);
	});

	it('stays on in a production build', () => {
		expect(rateLimitsOff({ DEV: false, MODE: 'production' })).toBe(false);
	});

	it('stays on under test, so the limits themselves are tested', () => {
		expect(rateLimitsOff({ DEV: true, MODE: 'test' })).toBe(false);
		expect(rateLimitsOff()).toBe(false);
	});
});
