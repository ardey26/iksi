import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { decodeQrImage } from './pay-qr-image';
import { MediaError } from './media';
import { payQrPayload } from '../../test/pay-qr';

function qrPng(text: string, width = 400) {
	return QRCode.toBuffer(text, { type: 'png', width, margin: 4 });
}

/** The QR pasted into a phone-sized JPEG screenshot, the way owners will upload it. */
async function screenshot(text: string) {
	const qr = await qrPng(text, 600);
	return sharp({ create: { width: 1170, height: 2532, channels: 3, background: '#f2f2f7' } })
		.composite([{ input: qr, top: 900, left: 285 }])
		.jpeg({ quality: 80 })
		.toBuffer();
}

async function errorOf(p: Promise<unknown>) {
	try {
		await p;
	} catch (e) {
		if (e instanceof MediaError) return e.code;
		throw e;
	}
	return 'no error';
}

describe('decodeQrImage', () => {
	it('reads the payload from a PNG', async () => {
		const payload = payQrPayload();
		expect(await decodeQrImage(await qrPng(payload))).toBe(payload);
	});

	it('reads a code from inside a phone screenshot', async () => {
		const payload = payQrPayload({ name: 'SARI-SARI NI ALING NENA', city: 'QUEZON CITY' });
		expect(await decodeQrImage(await screenshot(payload))).toBe(payload);
	});

	it('reads a code from a light-on-dark image', async () => {
		const inverted = await sharp(await qrPng('https://cash.app/$ana')).negate({ alpha: false }).png().toBuffer();
		expect(await decodeQrImage(inverted)).toBe('https://cash.app/$ana');
	});

	it('says so when the image has no QR code', async () => {
		const photo = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#336699' } })
			.png()
			.toBuffer();
		expect(await decodeQrImage(photo)).toBeNull();
	});

	it('refuses a file that is not an image', async () => {
		expect(await errorOf(decodeQrImage(new TextEncoder().encode('not an image at all')))).toBe('unsupported');
	});

	it('refuses an empty file', async () => {
		expect(await errorOf(decodeQrImage(new Uint8Array()))).toBe('empty');
	});
});
