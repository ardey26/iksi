import { describe, expect, it } from 'vitest';
import {
	addPayMethod,
	methodFromLink,
	PayMethodError,
	providerNotice,
	publicPayMethods,
	readPayMethods,
	removePayMethod,
	reorderPayMethods
} from './pay-methods';
import type { LinkMethod, PayMethod, QrMethod } from '#lib/pay-methods.js';
import { payQrPayload } from '../../test/pay-qr';

const link = (id: string, url = `https://paypal.me/${id}`): LinkMethod => ({ id, kind: 'link', provider: 'paypal', url });
const qr = (id: string, payload = payQrPayload(), provider: QrMethod['provider'] = 'gcash'): QrMethod => ({
	id,
	kind: 'qr',
	provider,
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

	const links = (n: number) => Array.from({ length: n }, (_, i) => link(`m${i}`));

	it('allows up to six methods, one per bank or wallet', () => {
		expect(addPayMethod(links(5), link('z'))).toHaveLength(6);
	});

	it('refuses a seventh method and says how many are allowed', () => {
		expect(codeOf(() => addPayMethod(links(6), link('z')))).toBe('too_many');
		expect(new PayMethodError('too_many').message).toBe('You can add up to 6 payment methods. Remove one to add another.');
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

	it('never returns more than six', () => {
		expect(readPayMethods(['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => link(id)))).toHaveLength(6);
	});

	it('reads a QR stored before providers were saved', () => {
		const { provider: _p, ...old } = qr('a', payQrPayload({ bic: 'BOPIPHMMXXX' }));
		expect(readPayMethods([old])).toEqual([{ ...old, provider: null }]);
	});

	it('names an old GCash QR by its BIC', () => {
		const { provider: _p, ...old } = qr('a');
		expect(readPayMethods([old])[0]).toMatchObject({ provider: 'gcash' });
	});

	it('keeps a stored Maya choice when the BIC is unknown', () => {
		const stored = qr('a', payQrPayload({ bic: 'BOPIPHMMXXX' }), 'maya');
		expect(readPayMethods([stored])[0]).toMatchObject({ provider: 'maya' });
	});

	it('trusts the BIC over a stored provider', () => {
		const stored = qr('a', payQrPayload({ bic: 'LAUIPHM2XXX' }), 'gcash');
		expect(readPayMethods([stored])[0]).toMatchObject({ provider: 'maribank' });
	});

	it('reads a stored GCash or MariBank choice with an unknown BIC as a bank QR', () => {
		for (const provider of ['gcash', 'maribank'] as const) {
			const stored = qr('a', payQrPayload({ bic: 'BOPIPHMMXXX' }), provider);
			expect(readPayMethods([stored])[0]).toMatchObject({ provider: null });
		}
	});

	it('drops a stored provider it does not know', () => {
		const stored = { ...qr('a', payQrPayload({ bic: 'BOPIPHMMXXX' })), provider: 'bpi' };
		expect(readPayMethods([stored])[0]).toMatchObject({ provider: null });
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

describe('providerNotice', () => {
	it.each([
		['gcash', "This isn't a GCash QR. Saved as a bank QR."],
		['maribank', "This isn't a MariBank QR. Saved as a bank QR."]
	] as const)('says when a QR chosen as %s is from another bank', (chosen, text) => {
		expect(providerNotice(chosen, qr('a', payQrPayload({ bic: 'BOPIPHMMXXX' }), null))).toBe(text);
	});

	it('says when the QR is from another app than the one chosen', () => {
		expect(providerNotice('gcash', qr('a', payQrPayload({ bic: 'LAUIPHM2XXX' }), 'maribank'))).toBe(
			'This is a MariBank QR. Saved as MariBank.'
		);
	});

	it.each([
		['the chosen app matches', 'gcash', qr('a')],
		['nothing was chosen', null, qr('a')],
		['Maya was chosen and the app is unknown', 'maya', qr('a', payQrPayload({ bic: 'BOPIPHMMXXX' }), 'maya')],
		['it is a link', 'gcash', link('a')]
	] as const)('says nothing when %s', (_name, chosen, method) => {
		expect(providerNotice(chosen, method)).toBeNull();
	});
});

describe('reorderPayMethods', () => {
	it('puts the methods in the given order', () => {
		expect(reorderPayMethods([link('a'), link('b'), link('c')], ['c', 'a', 'b'])?.map((m) => m.id)).toEqual(['c', 'a', 'b']);
	});

	it.each([
		['a missing id', ['a', 'b']],
		['an unknown id', ['a', 'b', 'z']],
		['a repeated id', ['a', 'a', 'b']],
		['not a list', 'a,b,c'],
		['ids that are not text', [1, 2, 3]]
	])('refuses an order with %s', (_name, order) => {
		expect(reorderPayMethods([link('a'), link('b'), link('c')], order)).toBeNull();
	});
});

describe('publicPayMethods', () => {
	it('leaves out the QR payload, which can hold a mobile number', () => {
		const out = publicPayMethods([qr('a'), link('b')]);
		expect(out).toEqual([
			{ id: 'a', kind: 'qr', provider: 'gcash', name: 'JUAN DELA CRUZ', city: 'MANDALUYONG', country: 'PH', currency: 'PHP' },
			link('b')
		]);
		expect(JSON.stringify(out)).not.toContain('09171234567');
	});
});
