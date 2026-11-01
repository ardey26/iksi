import { describe, expect, it } from 'vitest';
import {
	FALLBACK_QR_LABEL,
	defaultQrLabel,
	identifyInstitution,
	institutionById,
	monogramOf,
	normalizeBic,
	storedInstitution
} from './pay-institutions';

const account = (guid: string, bic?: string) => ({ guid, bic: bic ?? null });

describe('identifyInstitution', () => {
	it('knows GCash by its BIC', () => {
		expect(identifyInstitution([account('com.p2pqrpay', 'GXCHPHM2XXX')])).toMatchObject({
			id: 'gcash',
			name: 'GCash',
			logo: '/brands/gcash.svg'
		});
	});

	it('knows MariBank by its BIC', () => {
		expect(identifyInstitution([account('ph.ppmi.p2m', 'LAUIPHM2XXX')])).toMatchObject({
			id: 'maribank',
			name: 'MariBank',
			logo: '/brands/maribank.png'
		});
	});

	it('reads an 8-letter BIC as the same bank as its XXX branch', () => {
		expect(normalizeBic(' gxchphm2 ')).toBe('GXCHPHM2XXX');
		expect(identifyInstitution([account('com.p2pqrpay', 'GXCHPHM2')])?.id).toBe('gcash');
	});

	it('looks past an unknown account to a known one', () => {
		const accounts = [account('com.p2pqrpay', 'BOPIPHMMXXX'), account('ph.ppmi.p2m', 'LAUIPHM2XXX')];
		expect(identifyInstitution(accounts)?.id).toBe('maribank');
	});

	it.each([
		['an unknown BIC', [account('com.p2pqrpay', 'BOPIPHMMXXX')]],
		['no BIC', [account('com.p2pqrpay')]],
		['no account', []]
	])('names no bank for %s', (_name, accounts) => {
		expect(identifyInstitution(accounts)).toBeNull();
	});

	describe('Maya, whose BIC is unconfirmed', () => {
		it('is never guessed from a BIC', () => {
			// Plausible-looking Maya codes: none of them may be assumed to be Maya's.
			for (const bic of ['PAPHPHM1XXX', 'MAYAPHM2XXX', 'PYMYPHM2XXX']) {
				expect(identifyInstitution([account('com.p2pqrpay', bic)])).toBeNull();
			}
		});

		it('is known when the account GUID says Maya', () => {
			for (const guid of ['com.paymaya', 'ph.maya.qr', 'COM.PAYMAYA.P2P']) {
				expect(identifyInstitution([account(guid, 'BOPIPHMMXXX')])).toMatchObject({ id: 'maya', name: 'Maya' });
			}
		});

		it('is not read into a GUID that merely contains the letters', () => {
			expect(identifyInstitution([account('com.himayaw.qr')])).toBeNull();
		});

		it('loses to a BIC that names another bank', () => {
			expect(identifyInstitution([account('com.paymaya', 'GXCHPHM2XXX')])?.id).toBe('gcash');
		});
	});
});

describe('defaultQrLabel', () => {
	it('is the bank name when the bank is known', () => {
		expect(defaultQrLabel(institutionById('gcash'))).toBe('GCash');
	});

	it('falls back to Bank QR', () => {
		expect(defaultQrLabel(null)).toBe('Bank QR');
		expect(FALLBACK_QR_LABEL).toBe('Bank QR');
	});
});

describe('institutionById', () => {
	it.each(['gcash', 'maya', 'maribank'])('finds %s', (id) => {
		expect(institutionById(id)?.id).toBe(id);
	});

	it.each(['bpi', '', null, undefined, 3, 'toString'])('finds nothing for %j', (id) => {
		expect(institutionById(id)).toBeNull();
	});
});

describe('storedInstitution', () => {
	it('keeps a bank that is only known by marker', () => {
		expect(storedInstitution('maya')?.id).toBe('maya');
	});

	it('never takes a bank its own QR would name by BIC', () => {
		expect(storedInstitution('gcash')).toBeNull();
		expect(storedInstitution('maribank')).toBeNull();
	});

	it('ignores what it does not know', () => {
		expect(storedInstitution('bpi')).toBeNull();
		expect(storedInstitution(null)).toBeNull();
	});
});

describe('monogramOf', () => {
	it('is the first letter of the label, in capitals', () => {
		expect(monogramOf('Bank QR')).toBe('B');
		expect(monogramOf('shop')).toBe('S');
	});

	it('skips leading marks and spaces', () => {
		expect(monogramOf('  #1 tindahan')).toBe('1');
		expect(monogramOf('"Ñora"')).toBe('Ñ');
	});

	it('is a neutral mark when the label has no letter', () => {
		expect(monogramOf('')).toBe('?');
		expect(monogramOf('---')).toBe('?');
	});
});
