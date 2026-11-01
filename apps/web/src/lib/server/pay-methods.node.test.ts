// Uploads routed by what the QR holds, through the real decode path
// (sharp → jsQR) with codes rendered by the qrcode package.
import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import { methodFromImage, PayMethodError } from './pay-methods';
import { MediaError } from './media';
import { damagedPayload, payQrPayload } from '../../test/pay-qr';

const qrPng = (text: string) => QRCode.toBuffer(text, { type: 'png', width: 400, margin: 4 });
const newId = () => 'id1';

async function errorOf(p: Promise<unknown>) {
	try {
		await p;
	} catch (e) {
		if (e instanceof PayMethodError || e instanceof MediaError) return e.code;
		throw e;
	}
	return 'no error';
}

describe('methodFromImage', () => {
	it('turns an EMVCo payment QR into a QR method', async () => {
		const payload = payQrPayload();
		expect(await methodFromImage(await qrPng(payload), newId)).toEqual({
			id: 'id1',
			kind: 'qr',
			payload,
			name: 'JUAN DELA CRUZ',
			city: 'MANDALUYONG',
			country: 'PH',
			currency: 'PHP'
		});
	});

	it('accepts a Singapore payment QR with an arbitrary GUID', async () => {
		const payload = payQrPayload({ country: 'SG', currency: '702', guid: 'sg.examplebank.qr', name: 'TAN AH KOW' });
		expect(await methodFromImage(await qrPng(payload), newId)).toMatchObject({
			kind: 'qr',
			name: 'TAN AH KOW',
			country: 'SG',
			currency: 'SGD'
		});
	});

	it('turns a QR holding a Venmo link into a link method', async () => {
		expect(await methodFromImage(await qrPng('https://venmo.com/u/ana-reyes'), newId)).toEqual({
			id: 'id1',
			kind: 'link',
			provider: 'venmo',
			url: 'https://venmo.com/u/ana-reyes'
		});
	});

	it('refuses a QR holding a link that is not on the allow-list', async () => {
		const err = methodFromImage(await qrPng('https://example.com/menu'), newId);
		await expect(err).rejects.toThrow("That QR isn't a payment QR or a supported payment link.");
	});

	it('refuses a QR holding plain text', async () => {
		expect(await errorOf(methodFromImage(await qrPng('WIFI:S:cafe;P:hunter2;;'), newId))).toBe('not_payment');
	});

	it('calls a payment QR with a wrong checksum damaged', async () => {
		expect(await errorOf(methodFromImage(await qrPng(damagedPayload()), newId))).toBe('damaged');
	});

	it('says so when the image has no QR code', async () => {
		const { default: sharp } = await import('sharp');
		const photo = await sharp({ create: { width: 400, height: 300, channels: 3, background: '#888' } }).png().toBuffer();
		expect(await errorOf(methodFromImage(photo, newId))).toBe('not_qr');
	});
});
