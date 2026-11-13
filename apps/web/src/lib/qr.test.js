import { describe, it, expect, vi, beforeEach } from 'vitest';

const qr = vi.hoisted(() => ({ toDataURL: vi.fn() }));
vi.mock('qrcode', () => ({ default: qr }));

import { dataUrlToBlob, iksiQR, QR_OPTIONS } from './qr.js';

beforeEach(() => qr.toDataURL.mockReset().mockResolvedValue('data:image/png;base64,AAAA'));

describe('iksiQR', () => {
	// The mark covers part of the code: only H recovers enough for it to scan.
	it('draws with error correction H at the asked size, in our colors', async () => {
		await iksiQR('https://iksi.app/abc', 560);
		expect(qr.toDataURL).toHaveBeenCalledWith('https://iksi.app/abc', { ...QR_OPTIONS, width: 560 });
		expect(QR_OPTIONS.errorCorrectionLevel).toBe('H');
		expect(QR_OPTIONS.color).toEqual({ dark: '#0A0A0B', light: '#FFFFFF' });
	});

	it('returns the plain code where there is no 2D canvas, so it still scans', async () => {
		expect(await iksiQR('https://iksi.app/abc')).toBe('data:image/png;base64,AAAA');
	});

});

describe('dataUrlToBlob', () => {
	// fetch(dataUrl) is blocked by the CSP (connect-src 'self'), so it is decoded in place.
	it('decodes a base64 data URL to a typed Blob', async () => {
		const blob = dataUrlToBlob('data:image/png;base64,' + btoa('png!'));
		expect(blob.type).toBe('image/png');
		expect(await blob.text()).toBe('png!');
	});
});
