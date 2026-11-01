import { describe, expect, it } from 'vitest';
import { addPayMethod, methodFromLink, PayMethodError, readPayMethods, removePayMethod } from './pay-methods';
import type { LinkMethod, PayMethod, QrMethod } from '#lib/pay-methods.js';
import { payQrPayload } from '../../test/pay-qr';

const link = (id: string, url = `https://paypal.me/${id}`): LinkMethod => ({ id, kind: 'link', provider: 'paypal', url });
const qr = (id: string, payload = payQrPayload()): QrMethod => ({
	id,
	kind: 'qr',
	payload,
	name: 'JUAN DELA CRUZ',
	city: 'MANDALUYONG',
	country: 'PH',
	currency: 'PHP'
});

function codeOf(fn: () => unknown) {
	try {
		fn();
	} catch (e) {
		if (e instanceof PayMethodError) return e.code;
		throw e;
	}
	return 'no error';
}

describe('addPayMethod', () => {
	it('appends a method', () => {
		expect(addPayMethod([link('a')], qr('b')).map((m) => m.id)).toEqual(['a', 'b']);
	});

	it('allows up to three methods', () => {
		const three = addPayMethod([link('a'), link('b')], link('c'));
		expect(three).toHaveLength(3);
	});

	it('refuses a fourth method', () => {
		expect(codeOf(() => addPayMethod([link('a'), link('b'), link('c')], link('d')))).toBe('too_many');
	});

	it('refuses the same link twice', () => {
		expect(codeOf(() => addPayMethod([link('a', 'https://paypal.me/ana')], link('b', 'https://paypal.me/ana')))).toBe(
			'duplicate'
		);
	});

	it('refuses the same QR twice', () => {
		expect(codeOf(() => addPayMethod([qr('a')], qr('b')))).toBe('duplicate');
	});
});

describe('removePayMethod', () => {
	it('removes by id and keeps the order of the rest', () => {
		expect(removePayMethod([link('a'), link('b'), link('c')], 'b').map((m) => m.id)).toEqual(['a', 'c']);
	});

	it('returns null for an unknown id', () => {
		expect(removePayMethod([link('a')], 'zz')).toBeNull();
	});
});

describe('readPayMethods', () => {
	it('reads stored methods', () => {
		const stored: PayMethod[] = [qr('a'), link('b')];
		expect(readPayMethods(JSON.parse(JSON.stringify(stored)))).toEqual(stored);
	});

	it.each([null, undefined, 'x', 3, {}])('reads %j as no methods', (v) => {
		expect(readPayMethods(v)).toEqual([]);
	});

	it('drops entries that are not methods', () => {
		const out = readPayMethods([link('a'), { kind: 'link', id: 'b' }, { kind: 'card' }, null, qr('c')]);
		expect(out.map((m) => m.id)).toEqual(['a', 'c']);
	});

	it('never returns more than three', () => {
		expect(readPayMethods([link('a'), link('b'), link('c'), link('d')])).toHaveLength(3);
	});

	it('drops a stored link that no longer passes the allow-list', () => {
		expect(readPayMethods([{ id: 'a', kind: 'link', provider: 'paypal', url: 'https://evil.example/' }])).toEqual([]);
	});
});

describe('methodFromLink', () => {
	it('makes a link method from an allowed link', () => {
		expect(methodFromLink(' https://ko-fi.com/ana ', () => 'id1')).toEqual({
			id: 'id1',
			kind: 'link',
			provider: 'kofi',
			url: 'https://ko-fi.com/ana'
		});
	});

	it.each([
		['https://paypal.me.evil.com/ana', 'unsupported'],
		['http://paypal.me/ana', 'not_https']
	])('refuses %s', (url, code) => {
		expect(codeOf(() => methodFromLink(url, () => 'x'))).toBe(code);
	});

	it('explains a refusal in words', () => {
		try {
			methodFromLink('https://example.com/', () => 'x');
		} catch (e) {
			expect((e as Error).message).toMatch(/^Use a link from PayPal/);
		}
	});
});
