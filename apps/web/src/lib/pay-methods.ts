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

export interface QrMethod {
	id: string;
	kind: 'qr';
	/** The bank's BIC as the QR states it (sub-tag 01 of a merchant account), when it has one. */
	bic?: string;
	/** Registry id (#lib/pay-institutions) of the bank the QR is for. Absent when unknown. */
	institution?: string;
	/** What payers and the owner call it: the bank's name, "Bank QR", or the owner's own name for it. */
	label: string;
	/** EMVCo payload text; the QR is rendered from it, the uploaded image is never kept. */
	payload: string;
	/** Merchant name (tag 59) exactly as the QR holds it, usually in capitals. Shown through titleCase. */
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
export type PublicQrMethod = Omit<QrMethod, 'payload' | 'bic'>;
export type PublicPayMethod = PublicQrMethod | LinkMethod;

/** How a method is named to payers and in the dashboard: "GCash", "Bank QR", "Shop", "PayPal". */
export function methodTitle(m: PublicPayMethod): string {
	return m.kind === 'link' ? PROVIDER_NAMES[m.provider] : m.label;
}

export const MAX_METHOD_LABEL_LENGTH = 24;

export type MethodLabelResult = { ok: true; label: string | null } | { ok: false };

/**
 * A name the owner gives a QR method: plain text, up to 24 characters. Control,
 * formatting and direction characters and angle brackets are refused rather than
 * stripped, so what is saved is what was typed. An empty name (null) means
 * "back to the default".
 */
export function parseMethodLabel(v: unknown): MethodLabelResult {
	if (typeof v !== 'string' || /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}<>]/u.test(v)) return { ok: false };
	const label = v.normalize('NFC').trim().replace(/\s+/g, ' ');
	if (!label) return { ok: true, label: null };
	return [...label].length > MAX_METHOD_LABEL_LENGTH ? { ok: false } : { ok: true, label };
}

const ROMAN = /(^|\s)(i{2,3}|iv)(?=$|[\s,.])/gi;

/**
 * "Maria Santos" for "MARIA SANTOS": QRs hold names and cities in capitals. Text
 * that already has lowercase letters is the owner's or bank's own casing and is
 * kept. Only for display; the raw value is what is stored.
 */
export function titleCase(raw: string): string {
	const s = raw.trim().replace(/\s+/g, ' ');
	if (/\p{Ll}/u.test(s)) return s;
	return s
		.toLocaleLowerCase('en')
		.replace(/(^|[^\p{L}\p{M}\p{N}*])(\p{L})/gu, (_, before: string, ch: string) => before + ch.toLocaleUpperCase('en'))
		.replace(ROMAN, (_, before: string, numeral: string) => before + numeral.toUpperCase());
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

/** "Quezon City, Philippines": where a QR's merchant is. */
export function qrPlace(m: Pick<QrMethod, 'city' | 'country'>): string {
	return [m.city && titleCase(m.city), countryName(m.country)].filter(Boolean).join(', ');
}
