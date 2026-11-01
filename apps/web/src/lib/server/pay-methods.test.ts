import { describe, expect, it } from 'vitest';
import {
	addPayMethod,
	methodFromLink,
	PayMethodError,
	publicPayMethods,
	readPayMethods,
	removePayMethod,
	renamePayMethod,
	reorderPayMethods
} from './pay-methods';
import type { LinkMethod, PayMethod, QrMethod } from '#lib/pay-methods.js';
import { payQrPayload } from '../../test/pay-qr';

const link = (id: string, url = `https://paypal.me/${id}`): LinkMethod => ({ id, kind: 'link', provider: 'paypal', url });
const qr = (id: string, payload = payQrPayload(), over: Partial<QrMethod> = {}): QrMethod => ({
	id,
	kind: 'qr',
	bic: 'GXCHPHM2XXX',
	institution: 'gcash',
	label: 'GCash',
	payload,
	name: 'JUAN DELA CRUZ',
	city: 'MANDALUYONG',
	country: 'PH',
	currency: 'PHP',
	...over
});
const bank = (id: string) =>
	qr(id, payQrPayload({ bic: 'BOPIPHMMXXX' }), { bic: 'BOPIPHMMXXX', institution: undefined, label: 'Bank QR' });

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

	it('names a QR of an unknown bank Bank QR, with no bank', () => {
		const [m] = readPayMethods([bank('a')]) as QrMethod[];
		expect(m.label).toBe('Bank QR');
		expect(m).not.toHaveProperty('institution');
		expect(m.bic).toBe('BOPIPHMMXXX');
	});

	it('keeps the name the owner gave a QR', () => {
		expect(readPayMethods([qr('a', payQrPayload(), { label: 'Shop' })])[0]).toMatchObject({ label: 'Shop', institution: 'gcash' });
	});

	it('names a QR by its bank once the registry learns it', () => {
		// Stored when the bank was unknown, so its label was the fallback.
		const stored = { ...bank('a'), payload: payQrPayload() };
		expect(readPayMethods([stored])[0]).toMatchObject({ institution: 'gcash', label: 'GCash' });
	});

	it('replaces a stored label that is not a valid name', () => {
		expect(readPayMethods([qr('a', payQrPayload(), { label: '<b>x</b>' })])[0]).toMatchObject({ label: 'GCash' });
		expect(readPayMethods([qr('a', payQrPayload(), { label: 'x'.repeat(40) })])[0]).toMatchObject({ label: 'GCash' });
	});

	it('trusts the BIC over a stored bank', () => {
		const stored = qr('a', payQrPayload({ bic: 'LAUIPHM2XXX' }), { institution: 'gcash', label: 'GCash' });
		expect(readPayMethods([stored])[0]).toMatchObject({ institution: 'maribank', bic: 'LAUIPHM2XXX' });
	});

	it('never takes a stored claim to a bank known by BIC', () => {
		const stored = { ...bank('a'), institution: 'gcash' };
		expect(readPayMethods([stored])[0]).not.toHaveProperty('institution');
	});

	describe('methods saved by the version with wallet tiles', () => {
		// That version stored `provider` (gcash, maya, maribank or null) and no label, bic or institution.
		const legacy = (id: string, payload: string, provider: string | null) => {
			const { label: _l, bic: _b, institution: _i, ...rest } = qr(id, payload);
			return { ...rest, provider };
		};

		it('reads a GCash QR as GCash, named GCash', () => {
			const [m] = readPayMethods([legacy('a', payQrPayload(), 'gcash')]);
			expect(m).toMatchObject({ institution: 'gcash', label: 'GCash', bic: 'GXCHPHM2XXX' });
			expect(m).not.toHaveProperty('provider');
		});

		it('reads a QR stored before providers were saved by its BIC', () => {
			expect(readPayMethods([legacy('a', payQrPayload({ bic: 'LAUIPHM2XXX' }), undefined as any)])[0]).toMatchObject({
				institution: 'maribank',
				label: 'MariBank'
			});
		});

		it('keeps a Maya choice the owner made, as the QR cannot prove or refute it', () => {
			expect(readPayMethods([legacy('a', payQrPayload({ bic: 'BOPIPHMMXXX' }), 'maya')])[0]).toMatchObject({
				institution: 'maya',
				label: 'Maya'
			});
		});

		it('keeps Maya once saved again in the new shape', () => {
			const once = readPayMethods([legacy('a', payQrPayload({ bic: 'BOPIPHMMXXX' }), 'maya')]);
			expect(readPayMethods(JSON.parse(JSON.stringify(once)))[0]).toMatchObject({ institution: 'maya', label: 'Maya' });
		});

		it('reads a GCash or MariBank choice the BIC does not back as a bank QR', () => {
			for (const provider of ['gcash', 'maribank']) {
				const [m] = readPayMethods([legacy('a', payQrPayload({ bic: 'BOPIPHMMXXX' }), provider)]);
				expect(m).toMatchObject({ label: 'Bank QR' });
				expect(m).not.toHaveProperty('institution');
			}
		});

		it('drops a provider it does not know', () => {
			const [m] = readPayMethods([legacy('a', payQrPayload({ bic: 'BOPIPHMMXXX' }), 'bpi')]);
			expect(m).toMatchObject({ label: 'Bank QR' });
			expect(m).not.toHaveProperty('institution');
		});
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

describe('renamePayMethod', () => {
	it('renames a QR', () => {
		const out = renamePayMethod([qr('a'), bank('b')], 'b', '  Shop  QR ');
		expect(out?.map((m) => (m.kind === 'qr' ? m.label : ''))).toEqual(['GCash', 'Shop QR']);
	});

	it('puts the default name back for an empty name', () => {
		expect(renamePayMethod([qr('a', payQrPayload(), { label: 'Shop' })], 'a', '')?.[0]).toMatchObject({ label: 'GCash' });
		expect(renamePayMethod([{ ...bank('a'), label: 'Shop' }], 'a', ' ')?.[0]).toMatchObject({ label: 'Bank QR' });
	});

	it.each([
		['more than 24 characters', 'x'.repeat(25)],
		['markup', '<script>'],
		['a line break', 'a\nb'],
		['a non-text value', 5]
	])('refuses a name with %s', (_name, label) => {
		expect(codeOf(() => renamePayMethod([qr('a')], 'a', label))).toBe('bad_label');
		expect(new PayMethodError('bad_label').message).toBe('Names can be up to 24 characters of plain text.');
	});

	it('returns null for an unknown id or a link', () => {
		expect(renamePayMethod([qr('a')], 'zz', 'Shop')).toBeNull();
		expect(renamePayMethod([link('a')], 'a', 'Shop')).toBeNull();
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
			{
				id: 'a',
				kind: 'qr',
				institution: 'gcash',
				label: 'GCash',
				name: 'JUAN DELA CRUZ',
				city: 'MANDALUYONG',
				country: 'PH',
				currency: 'PHP'
			},
			link('b')
		]);
		expect(JSON.stringify(out)).not.toContain('09171234567');
	});
});
