import { describe, expect, it } from 'vitest';
import { MAX_METHOD_LABEL_LENGTH, methodTitle, parseMethodLabel, qrPlace, titleCase } from './pay-methods';

describe('titleCase', () => {
	it.each([
		['MARIA SANTOS', 'Maria Santos'],
		['QUEZON CITY', 'Quezon City'],
		['JUAN DELA CRUZ', 'Juan Dela Cruz'],
		['  MARIA   SANTOS ', 'Maria Santos'],
		["MARY-ANNE O'NEIL", "Mary-Anne O'Neil"],
		['STA. MESA', 'Sta. Mesa'],
		['JOSE RIZAL III', 'Jose Rizal III'],
		['PEÑA', 'Peña'],
		['MA.CRISTINA', 'Ma.Cristina'],
		['JU*N D*LA CR*Z', 'Ju*n D*la Cr*z']
	])('sets %j as %j', (raw, out) => {
		expect(titleCase(raw)).toBe(out);
	});

	it('leaves text that is already mixed case alone', () => {
		expect(titleCase('McDonald Store')).toBe('McDonald Store');
		expect(titleCase('iksi')).toBe('iksi');
	});

	it('keeps an empty value empty', () => {
		expect(titleCase('')).toBe('');
	});
});

describe('qrPlace', () => {
	it('names the city in title case and the country in full', () => {
		expect(qrPlace({ city: 'QUEZON CITY', country: 'PH' })).toBe('Quezon City, Philippines');
		expect(qrPlace({ city: null, country: 'SG' })).toBe('Singapore');
	});
});

describe('parseMethodLabel', () => {
	it('accepts plain text and tidies its spaces', () => {
		expect(parseMethodLabel('  Shop   GCash ')).toEqual({ ok: true, label: 'Shop GCash' });
	});

	it(`accepts up to ${MAX_METHOD_LABEL_LENGTH} characters, counting each letter once`, () => {
		expect(MAX_METHOD_LABEL_LENGTH).toBe(24);
		expect(parseMethodLabel('a'.repeat(24))).toEqual({ ok: true, label: 'a'.repeat(24) });
		expect(parseMethodLabel('ñ'.repeat(24)).ok).toBe(true);
		expect(parseMethodLabel('a'.repeat(25))).toEqual({ ok: false });
	});

	it('reads an empty name as a reset to the default', () => {
		expect(parseMethodLabel('   ')).toEqual({ ok: true, label: null });
	});

	it.each([
		['markup', '<b>Shop</b>'],
		['a line break', 'Shop\nGCash'],
		['a direction override', 'Shop‮abc'],
		['a zero-width character', 'Sh​op'],
		['a non-text value', 42],
		['nothing', undefined]
	])('refuses %s', (_name, v) => {
		expect(parseMethodLabel(v)).toEqual({ ok: false });
	});
});

describe('methodTitle', () => {
	it('names a QR by its label and a link by its service', () => {
		expect(
			methodTitle({ id: 'a', kind: 'qr', label: 'Shop', name: 'X', city: null, country: 'PH', currency: 'PHP' })
		).toBe('Shop');
		expect(methodTitle({ id: 'b', kind: 'link', provider: 'kofi', url: 'https://ko-fi.com/a' })).toBe('Ko-fi');
	});
});
