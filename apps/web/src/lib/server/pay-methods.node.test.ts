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
			bic: 'GXCHPHM2XXX',
			institution: 'gcash',
			label: 'GCash',
			payload,
			name: 'JUAN DELA CRUZ',
			city: 'MANDALUYONG',
			country: 'PH',
			currency: 'PHP'
		});
	});

	it('names a MariBank QR by its BIC', async () => {
		const payload = payQrPayload({ bic: 'LAUIPHM2XXX' });
		expect(await methodFromImage(await qrPng(payload), newId)).toMatchObject({ institution: 'maribank', label: 'MariBank' });
	});

	it('calls a QR from a bank it does not know Bank QR', async () => {
		const payload = payQrPayload({ bic: 'BOPIPHMMXXX' });
		const m = await methodFromImage(await qrPng(payload), newId);
		expect(m).toMatchObject({ kind: 'qr', bic: 'BOPIPHMMXXX', label: 'Bank QR' });
		expect(m).not.toHaveProperty('institution');
	});

	it('names a Maya QR by its confirmed BIC', async () => {
		const m = await methodFromImage(await qrPng(payQrPayload({ guid: 'ph.ppmi.p2m', bic: 'PAPHPHM1XXX' })), newId);
		expect(m).toMatchObject({ label: 'Maya', institution: 'maya' });
	});

	it('does not take a Maya-looking but unconfirmed BIC for Maya', async () => {
		const m = await methodFromImage(await qrPng(payQrPayload({ bic: 'MAYAPHM2XXX' })), newId);
		expect(m).toMatchObject({ label: 'Bank QR' });
		expect(m).not.toHaveProperty('institution');
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

	it("turns Venmo's own app QR (a /code link) into a link method", async () => {
		expect(await methodFromImage(await qrPng('https://venmo.com/code?user_id=123'), newId)).toMatchObject({
			kind: 'link',
			provider: 'venmo',
			url: 'https://venmo.com/code?user_id=123'
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
