// Payment methods behind a profile's Pay button. Shared by the server, the
// dashboard and the public profile page.

// Shops usually keep one QR per bank or e-wallet.
export const MAX_PAY_METHODS = 6;

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

/** Philippine wallets offered first in the dashboard, each with a logo. */
export type QrProvider = 'gcash' | 'maya' | 'maribank';

export const QR_PROVIDERS: QrProvider[] = ['gcash', 'maya', 'maribank'];

export interface QrProviderInfo {
	name: string;
	/** A trademark, shown only to say which payment app the QR is for. */
	logo: string;
	/** Natural aspect of the logo, as width / height. */
	aspect: number;
	/** The logo already spells the name, so the name is not repeated under it. */
	wordmark: boolean;
}

export const QR_PROVIDER_INFO: Record<QrProvider, QrProviderInfo> = {
	gcash: { name: 'GCash', logo: '/brands/gcash.svg', aspect: 72 / 61, wordmark: false },
	maya: { name: 'Maya', logo: '/brands/maya.svg', aspect: 112 / 33, wordmark: true },
	maribank: { name: 'MariBank', logo: '/brands/maribank.png', aspect: 152 / 128, wordmark: false }
};

export function parseQrProvider(v: unknown): QrProvider | null {
	return typeof v === 'string' && (QR_PROVIDERS as string[]).includes(v) ? (v as QrProvider) : null;
}

export interface QrMethod {
	id: string;
	kind: 'qr';
	/** The wallet the QR is for: from its BIC when known, else the owner's choice. Null for any other bank. */
	provider: QrProvider | null;
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

/**
 * What the public profile page gets. A personal QR's payload usually holds
 * the owner's mobile number, so it is fetched only when the Pay sheet opens.
 */
export type PublicQrMethod = Omit<QrMethod, 'payload'>;
export type PublicPayMethod = PublicQrMethod | LinkMethod;

/** How a method is named to payers and in the dashboard: "GCash", "BPI QR", "PayPal". */
export function methodTitle(m: PublicPayMethod): string {
	if (m.kind === 'link') return PROVIDER_NAMES[m.provider];
	return m.provider ? QR_PROVIDER_INFO[m.provider].name : 'Bank QR';
}

export type PayLabel = 'pay' | 'tip';

export const PAY_LABEL_TEXT: Record<PayLabel, string> = {
	pay: 'Pay',
	tip: 'Send a tip'
};

export function payLabelOf(v: unknown): PayLabel {
	return v === 'tip' ? 'tip' : 'pay';
}

/** "Philippines" for "PH"; the code itself where the name is unknown. */
export function countryName(code: string): string {
	try {
		return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
	} catch {
		return code;
	}
}

/** "MANDALUYONG, Philippines": where a QR's merchant is. */
export function qrPlace(m: Pick<QrMethod, 'city' | 'country'>): string {
	return [m.city, countryName(m.country)].filter(Boolean).join(', ');
}
