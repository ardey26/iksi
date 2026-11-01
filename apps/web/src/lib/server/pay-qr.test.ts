import { describe, expect, it } from 'vitest';
import { crc16, MAX_PAYLOAD_LENGTH, parseTlv, PAY_QR_ERROR_TEXT, validatePayQr } from './pay-qr';
import { damagedPayload, payQrBody, payQrPayload, testCrc, tlv, withCrc } from '../../test/pay-qr';

const codeOf = (text: string) => {
	const r = validatePayQr(text);
	return r.ok ? 'ok' : r.code;
};

describe('crc16', () => {
	it('matches the CRC-16/CCITT-FALSE check value', () => {
		expect(crc16('123456789')).toBe('29B1');
		expect(testCrc('123456789')).toBe('29B1');
	});

	it('agrees with the test builder on a real payload body', () => {
		const head = payQrBody() + '6304';
		expect(crc16(head)).toBe(testCrc(head));
	});
});

describe('parseTlv', () => {
	it('reads tags in order', () => {
		expect(parseTlv(tlv('00', '01') + tlv('59', 'ANA'))).toEqual([
			['00', '01'],
			['59', 'ANA']
		]);
	});

	it.each([
		['a length past the end', '0005ab'],
		['a non-numeric length', '00x1a'],
		['a non-numeric tag', 'ab01a'],
		['trailing bytes', '0001a0'],
		['a duplicate tag', '0001a0001b'],
		['an empty string', '']
	])('refuses %s', (_name, s) => {
		expect(parseTlv(s)).toBeNull();
	});
});

describe('validatePayQr', () => {
	it('accepts a P2P QR Ph code and extracts name, city, country and currency', () => {
		const payload = payQrPayload();
		expect(validatePayQr(payload)).toEqual({
			ok: true,
			value: { payload, name: 'JUAN DELA CRUZ', city: 'MANDALUYONG', country: 'PH', currency: 'PHP' }
		});
	});

	it('accepts a Singapore code with an arbitrary GUID', () => {
		const r = validatePayQr(payQrPayload({ country: 'SG', currency: '702', guid: 'sg.examplebank.qr', merchantTag: '30' }));
		expect(r.ok && r.value).toMatchObject({ country: 'SG', currency: 'SGD' });
	});

	it.each([
		['764', 'THB'],
		['458', 'MYR'],
		['360', 'IDR'],
		['704', 'VND'],
		['840', 'USD']
	])('names currency %s as %s', (num, letters) => {
		const r = validatePayQr(payQrPayload({ currency: num }));
		expect(r.ok && r.value.currency).toBe(letters);
	});

	it('shows an unmapped currency as its number', () => {
		const r = validatePayQr(payQrPayload({ country: 'DE', currency: '978' }));
		expect(r.ok && r.value.currency).toBe('978');
	});

	it('accepts a P2M code', () => {
		expect(codeOf(payQrPayload({ guid: 'ph.ppmi.p2m', merchantTag: '28' }))).toBe('ok');
	});

	it('accepts any bank or e-wallet GUID, not only known ones', () => {
		expect(codeOf(payQrPayload({ guid: 'ph.examplebank.qr', merchantTag: '51' }))).toBe('ok');
	});

	it('accepts a lowercase checksum', () => {
		const p = payQrPayload();
		expect(codeOf(p.slice(0, -4) + p.slice(-4).toLowerCase())).toBe('ok');
	});

	it('trims the name and city', () => {
		const r = validatePayQr(payQrPayload({ name: ' ANA ', city: ' CEBU ' }));
		expect(r.ok && r.value).toMatchObject({ name: 'ANA', city: 'CEBU' });
	});

	it('returns a null city when tag 60 is missing', () => {
		const r = validatePayQr(payQrPayload({ city: null }));
		expect(r.ok && r.value.city).toBeNull();
	});

	it('calls a wrong checksum damaged', () => {
		expect(codeOf(damagedPayload())).toBe('damaged');
	});

	it('calls a payload edited after signing damaged', () => {
		const p = payQrPayload();
		expect(codeOf(p.replace('JUAN', 'JUAM'))).toBe('damaged');
	});

	it('calls a missing checksum malformed', () => {
		expect(codeOf(payQrBody())).toBe('malformed');
	});

	it('calls a checksummed payload that is not TLV malformed', () => {
		expect(codeOf(withCrc('000201' + '59ZZ'))).toBe('malformed');
	});

	it.each([
		['a missing country', { country: '' }],
		['a three-letter country', { country: 'PHL' }],
		['a missing currency', { currency: '' }],
		['a lettered currency', { currency: 'PHP' }]
	])('calls %s malformed', (_name, parts) => {
		expect(codeOf(payQrPayload(parts))).toBe('malformed');
	});

	it.each([
		['a plain URL', 'https://example.com/menu'],
		['plain text', 'hello there'],
		['a wrong format indicator', withCrc(payQrBody().replace(/^000201/, '000202'))]
	])('refuses %s as not a payment code', (_name, text) => {
		expect(codeOf(text)).toBe('not_payment');
	});

	it('refuses a payment code with no merchant account template', () => {
		const body = tlv('00', '01') + tlv('52', '6016') + tlv('53', '608') + tlv('58', 'PH') + tlv('59', 'ANA');
		expect(codeOf(withCrc(body))).toBe('not_payment');
	});

	it('refuses a template with an empty GUID', () => {
		expect(codeOf(payQrPayload({ guid: '' }))).toBe('not_payment');
	});

	it('refuses a template that is not TLV', () => {
		const body =
			tlv('00', '01') + tlv('27', 'hello') + tlv('53', '608') + tlv('58', 'PH') + tlv('59', 'ANA');
		expect(codeOf(withCrc(body))).toBe('not_payment');
	});

	it('calls a code with no merchant name malformed', () => {
		expect(codeOf(payQrPayload({ name: null }))).toBe('malformed');
	});

	it('refuses a payload over the EMVCo maximum', () => {
		// Otherwise valid: unreserved templates 80–85 pad it past the limit.
		const pad = ['80', '81', '82', '83', '84', '85'].map((t) => tlv(t, 'X'.repeat(99))).join('');
		const long = withCrc(payQrBody() + pad);
		expect(long.length).toBeGreaterThan(MAX_PAYLOAD_LENGTH);
		expect(codeOf(long)).toBe('not_payment');
	});

	it('has a message for every refusal', () => {
		for (const code of ['not_qr', 'not_payment', 'damaged', 'malformed'] as const) {
			expect(PAY_QR_ERROR_TEXT[code]).toMatch(/\.$/);
		}
	});
});
