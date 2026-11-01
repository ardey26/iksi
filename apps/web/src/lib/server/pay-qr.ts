// Payment QR codes in the EMVCo merchant-presented format: QR Ph, PayNow,
// PromptPay, DuitNow, QRIS and others. Any well-formed payload is accepted,
// whatever the country or issuer; there is no allow-list.
//
// What this cannot prove: that the code belongs to the profile owner. The
// decoded merchant name (tag 59) is shown to payers as the safeguard.

import type { QrProvider } from '#lib/pay-methods.js';

export type PayQrErrorCode = 'not_qr' | 'not_payment' | 'damaged' | 'malformed';

export const PAY_QR_ERROR_TEXT: Record<PayQrErrorCode, string> = {
	not_qr: 'No QR code found in that image. Try a sharper screenshot.',
	not_payment: "That QR isn't a payment QR or a supported payment link.",
	damaged: 'That QR is damaged and cannot be read. Save a fresh copy from your app and try again.',
	malformed: 'That payment QR is incomplete. Save a fresh copy from your bank or e-wallet app.'
};

export interface PayQr {
	/** The full payload text, as decoded from the image. */
	payload: string;
	/** Merchant or account name (tag 59), as the issuing app wrote it. */
	name: string;
	/** Merchant city (tag 60). */
	city: string | null;
	/** ISO 3166-1 alpha-2 country (tag 58). */
	country: string;
	/** Currency (tag 53): letters for common codes, otherwise the ISO 4217 number. */
	currency: string;
}

export type PayQrResult = { ok: true; value: PayQr } | { ok: false; code: PayQrErrorCode };

/** EMVCo's maximum payload length. */
export const MAX_PAYLOAD_LENGTH = 512;

const CRC_TAIL = /6304[0-9A-Fa-f]{4}$/;

const CURRENCY_LETTERS: Record<string, string> = {
	'608': 'PHP',
	'702': 'SGD',
	'764': 'THB',
	'458': 'MYR',
	'360': 'IDR',
	'704': 'VND',
	'840': 'USD'
};

/** CRC-16/CCITT-FALSE (init 0xFFFF, poly 0x1021) as four uppercase hex digits. */
export function crc16(s: string): string {
	let crc = 0xffff;
	for (const byte of new TextEncoder().encode(s)) {
		crc ^= byte << 8;
		for (let i = 0; i < 8; i++) {
			crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
		}
	}
	return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Splits an EMVCo TLV string (2-digit tag, 2-digit length, value) into
 * [tag, value] pairs. Null when it does not parse cleanly to the end or a tag repeats.
 */
export function parseTlv(s: string): [string, string][] | null {
	if (s.length === 0) return null;
	const out: [string, string][] = [];
	const seen = new Set<string>();
	let i = 0;
	while (i < s.length) {
		const head = s.slice(i, i + 4);
		if (!/^\d{4}$/.test(head)) return null;
		const tag = head.slice(0, 2);
		const len = Number(head.slice(2));
		const end = i + 4 + len;
		if (end > s.length || seen.has(tag)) return null;
		seen.add(tag);
		out.push([tag, s.slice(i + 4, end)]);
		i = end;
	}
	return out;
}

function isMerchantTag(tag: string): boolean {
	const n = Number(tag);
	return n >= 26 && n <= 51;
}

/** A merchant account template (tags 26–51) is itself TLV with a GUID in sub-tag 00. */
function hasMerchantAccount(fields: Map<string, string>): boolean {
	for (const [tag, value] of fields) {
		if (!isMerchantTag(tag)) continue;
		const sub = parseTlv(value);
		const guid = sub?.find(([t]) => t === '00')?.[1].trim();
		if (guid) return true;
	}
	return false;
}

export function validatePayQr(text: string): PayQrResult {
	const fail = (code: PayQrErrorCode): PayQrResult => ({ ok: false, code });

	if (text.length > MAX_PAYLOAD_LENGTH || !text.startsWith('000201')) return fail('not_payment');

	// Tag 63 is the checksum over everything up to and including "6304", so it must come last.
	if (!CRC_TAIL.test(text)) return fail('malformed');
	if (crc16(text.slice(0, -4)) !== text.slice(-4).toUpperCase()) return fail('damaged');

	const entries = parseTlv(text);
	if (!entries || entries[entries.length - 1][0] !== '63') return fail('malformed');
	const fields = new Map(entries);

	if (!hasMerchantAccount(fields)) return fail('not_payment');

	const country = fields.get('58') ?? '';
	const currency = fields.get('53') ?? '';
	const name = fields.get('59')?.trim();
	if (!/^[A-Za-z]{2}$/.test(country) || !/^\d{3}$/.test(currency) || !name) return fail('malformed');
	const city = fields.get('60')?.trim() || null;

	return {
		ok: true,
		value: {
			payload: text,
			name,
			city,
			country: country.toUpperCase(),
			currency: CURRENCY_LETTERS[currency] ?? currency
		}
	};
}

/**
 * BICs (sub-tag 01 of a QR Ph merchant account) of the wallets with a logo.
 * Maya's is not confirmed, so a Maya QR is known only by the owner's choice.
 */
const PROVIDER_BICS: Record<string, QrProvider> = {
	GXCHPHM2XXX: 'gcash',
	LAUIPHM2XXX: 'maribank'
};

/** The wallet a payment QR is for, from its BIC. Null when unknown or not a payment code. */
export function qrProviderOf(payload: string): QrProvider | null {
	const entries = parseTlv(payload);
	if (!entries) return null;
	for (const [tag, value] of entries) {
		if (!isMerchantTag(tag)) continue;
		const bic = parseTlv(value)?.find(([t]) => t === '01')?.[1].trim().toUpperCase();
		if (bic && PROVIDER_BICS[bic]) return PROVIDER_BICS[bic];
	}
	return null;
}
