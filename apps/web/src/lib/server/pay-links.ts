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

/** Exact hostnames (no subdomain wildcards) and the path that names an account. */
const RULES: { provider: PayProvider; hosts: string[]; path: RegExp }[] = [
	{ provider: 'paypal', hosts: ['paypal.me', 'www.paypal.me'], path: /^\/[^/]+/ },
	{ provider: 'paypal', hosts: ['paypal.com', 'www.paypal.com'], path: /^\/paypalme\/[^/]+/i },
	{ provider: 'venmo', hosts: ['venmo.com', 'www.venmo.com', 'account.venmo.com'], path: /^\/u\/[^/]+/ },
	{ provider: 'cashapp', hosts: ['cash.app'], path: /^\/\$[^/]+/ },
	{ provider: 'wise', hosts: ['wise.com'], path: /^\/pay\/[^/]+/ },
	{ provider: 'revolut', hosts: ['revolut.me'], path: /^\/[^/]+/ },
	{ provider: 'kofi', hosts: ['ko-fi.com', 'www.ko-fi.com'], path: /^\/[^/]+/ },
	{ provider: 'bmc', hosts: ['buymeacoffee.com', 'www.buymeacoffee.com'], path: /^\/[^/]+/ },
	{ provider: 'stripe', hosts: ['buy.stripe.com'], path: /^\/[^/]+/ }
];

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

	const rule = RULES.find((r) => r.hosts.includes(u.hostname) && r.path.test(u.pathname));
	return rule ? { ok: true, provider: rule.provider, url: u.href } : { ok: false, code: 'unsupported' };
}
