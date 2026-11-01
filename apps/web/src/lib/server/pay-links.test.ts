import { describe, expect, it } from 'vitest';
import { PAY_LINK_ERROR_TEXT, parsePayLink } from './pay-links';

describe('parsePayLink', () => {
	it.each([
		['https://paypal.me/anareyes', 'paypal'],
		['https://www.paypal.me/anareyes/10', 'paypal'],
		['https://www.paypal.com/paypalme/anareyes', 'paypal'],
		['https://paypal.com/paypalme/anareyes', 'paypal'],
		['https://venmo.com/u/ana-reyes', 'venmo'],
		['https://account.venmo.com/u/ana-reyes', 'venmo'],
		['https://cash.app/$anareyes', 'cashapp'],
		['https://wise.com/pay/me/anar', 'wise'],
		['https://wise.com/pay/r/AbC123', 'wise'],
		['https://revolut.me/anareyes', 'revolut'],
		['https://ko-fi.com/anareyes', 'kofi'],
		['https://www.ko-fi.com/anareyes', 'kofi'],
		['https://buymeacoffee.com/anareyes', 'bmc'],
		['https://www.buymeacoffee.com/anareyes', 'bmc'],
		['https://buy.stripe.com/test_8wM5mN0aB', 'stripe']
	])('accepts %s as %s', (url, provider) => {
		expect(parsePayLink(url)).toEqual({ ok: true, provider, url: new URL(url).href });
	});

	it('trims pasted whitespace', () => {
		expect(parsePayLink('  https://paypal.me/ana \n')).toEqual({
			ok: true,
			provider: 'paypal',
			url: 'https://paypal.me/ana'
		});
	});

	it('matches hosts case-insensitively', () => {
		expect(parsePayLink('https://PayPal.Me/ana')).toMatchObject({ ok: true, provider: 'paypal' });
	});

	it.each([
		'https://paypal.me.evil.com/ana',
		'https://evil.com/paypal.me/ana',
		'https://evilpaypal.me/ana',
		'https://paypal.me@evil.com/ana',
		'https://paypal.me:8443/ana',
		'https://user:pw@paypal.me/ana',
		'https://paypal.me./ana',
		'https://venmo.com.evil.io/u/ana',
		'https://notcash.app/$ana',
		'https://buy.stripe.com.evil.com/abc',
		'https://stripe.com/abc',
		'https://paypal.com/signin',
		'https://example.com/pay'
	])('refuses lookalike or unknown %s', (url) => {
		expect(parsePayLink(url)).toEqual({ ok: false, code: 'unsupported' });
	});

	it.each([
		'https://paypal.me/',
		'https://venmo.com/u/',
		'https://cash.app/ana',
		'https://wise.com/',
		'https://wise.com/pay/',
		'https://ko-fi.com/',
		'https://buy.stripe.com/'
	])('refuses %s, which names no account', (url) => {
		expect(parsePayLink(url)).toEqual({ ok: false, code: 'unsupported' });
	});

	it.each(['http://paypal.me/ana', 'paypal.me/ana', 'javascript:alert(1)//paypal.me/ana'])(
		'refuses %s, which is not https',
		(url) => {
			expect(parsePayLink(url)).toEqual({ ok: false, code: 'not_https' });
		}
	);

	it('refuses an overlong link', () => {
		expect(parsePayLink('https://paypal.me/' + 'a'.repeat(500))).toEqual({ ok: false, code: 'unsupported' });
	});

	it('names the services in its refusal', () => {
		expect(PAY_LINK_ERROR_TEXT.unsupported).toBe(
			'Use a link from PayPal, Venmo, Cash App, Wise, Revolut, Ko-fi, Buy Me a Coffee or Stripe.'
		);
	});
});
