// Payment links an owner may put behind their Pay button. Only these services
// are allowed: a payment button must never send payers to an arbitrary site.
import type { PayProvider } from '#lib/pay-methods.js';

export type PayLinkErrorCode = 'not_https' | 'unsupported';
export type PayLinkResult = { ok: true; provider: PayProvider; url: string } | { ok: false; code: PayLinkErrorCode };

export const PAY_LINK_ERROR_TEXT: Record<PayLinkErrorCode, string> = {
	not_https: 'Payment links must start with https://.',
	unsupported: 'Use a link from PayPal, Venmo, Cash App, Wise, Revolut, Ko-fi, Buy Me a Coffee or Stripe.'
};

const MAX_LENGTH = 500;

/**
 * Exact hostnames only: no subdomain wildcards, so paypal.me.evil.com and
 * evil.paypal.me are refused. Any path is allowed, which covers what the apps'
 * own QR codes hold (venmo.com/code?user_id=…, paypal.com/qrcodes/…).
 */
const HOSTS = new Map<string, PayProvider>(Object.entries({
	'paypal.me': 'paypal',
	'www.paypal.me': 'paypal',
	'paypal.com': 'paypal',
	'www.paypal.com': 'paypal',
	'venmo.com': 'venmo',
	'www.venmo.com': 'venmo',
	'account.venmo.com': 'venmo',
	'cash.app': 'cashapp',
	'wise.com': 'wise',
	'revolut.me': 'revolut',
	'ko-fi.com': 'kofi',
	'www.ko-fi.com': 'kofi',
	'buymeacoffee.com': 'bmc',
	'www.buymeacoffee.com': 'bmc',
	'buy.stripe.com': 'stripe'
}) as [string, PayProvider][]);

export function parsePayLink(input: string): PayLinkResult {
	const text = input.trim();
	let u: URL;
	try {
		u = new URL(text);
	} catch {
		return { ok: false, code: 'not_https' };
	}
	if (u.protocol !== 'https:') return { ok: false, code: 'not_https' };
	if (text.length > MAX_LENGTH || u.username || u.password || u.port) return { ok: false, code: 'unsupported' };

	const provider = HOSTS.get(u.hostname);
	return provider ? { ok: true, provider, url: u.href } : { ok: false, code: 'unsupported' };
}
