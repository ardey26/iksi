// Payment methods behind a profile's Pay button. Shared by the server, the
// dashboard and the public profile page.

export const MAX_PAY_METHODS = 3;

export type PayProvider = 'paypal' | 'venmo' | 'cashapp' | 'wise' | 'revolut' | 'kofi' | 'bmc' | 'stripe';

export const PROVIDER_NAMES: Record<PayProvider, string> = {
	paypal: 'PayPal',
	venmo: 'Venmo',
	cashapp: 'Cash App',
	wise: 'Wise',
	revolut: 'Revolut',
	kofi: 'Ko-fi',
	bmc: 'Buy Me a Coffee',
	stripe: 'Stripe'
};

export interface QrMethod {
	id: string;
	kind: 'qr';
	/** EMVCo payload text; the QR is rendered from it, the uploaded image is never kept. */
	payload: string;
	name: string;
	city: string | null;
	country: string;
	currency: string;
}

export interface LinkMethod {
	id: string;
	kind: 'link';
	provider: PayProvider;
	url: string;
}

export type PayMethod = QrMethod | LinkMethod;

export type PayLabel = 'pay' | 'tip';

export const PAY_LABEL_TEXT: Record<PayLabel, string> = {
	pay: 'Pay',
	tip: 'Send a tip'
};

export function payLabelOf(v: unknown): PayLabel {
	return v === 'tip' ? 'tip' : 'pay';
}
