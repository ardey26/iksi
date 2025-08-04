import '@testing-library/jest-dom';
import { beforeEach, vi } from 'vitest';

beforeEach(() => {
	if (!global.crypto) {
		global.crypto = {};
	}
	
	global.crypto.randomBytes = vi.fn((size) => {
		const buffer = new Uint8Array(size);
		for (let i = 0; i < size; i++) {
			buffer[i] = Math.floor(Math.random() * 256);
		}
		return buffer;
	});
});
