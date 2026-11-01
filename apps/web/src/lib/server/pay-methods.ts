// Building and editing a profile's payment methods. Nothing here touches the
// media store: an uploaded QR image is decoded in memory and discarded.
import {
	MAX_METHOD_LABEL_LENGTH,
	MAX_PAY_METHODS,
	parseMethodLabel,
	PROVIDER_NAMES,
	type LinkMethod,
	type PayMethod,
	type PayProvider,
	type PublicPayMethod,
	type QrMethod
} from '#lib/pay-methods.js';
import { defaultQrLabel, FALLBACK_QR_LABEL, storedInstitution } from '#lib/pay-institutions.js';
import { PAY_QR_ERROR_TEXT, qrBankOf, validatePayQr, type PayQr, type PayQrErrorCode } from './pay-qr';
import { PAY_LINK_ERROR_TEXT, parsePayLink, type PayLinkErrorCode } from './pay-links';

export type PayMethodErrorCode = PayQrErrorCode | PayLinkErrorCode | 'too_many' | 'duplicate' | 'bad_label';

const LIST_ERROR_TEXT = {
	too_many: `You can add up to ${MAX_PAY_METHODS} payment methods. Remove one to add another.`,
	duplicate: 'That payment method is already on your profile.',
	bad_label: `Names can be up to ${MAX_METHOD_LABEL_LENGTH} characters of plain text.`
};

export class PayMethodError extends Error {
	code: PayMethodErrorCode;
	constructor(code: PayMethodErrorCode) {
		const text: Record<PayMethodErrorCode, string> = { ...PAY_QR_ERROR_TEXT, ...PAY_LINK_ERROR_TEXT, ...LIST_ERROR_TEXT };
		super(text[code]);
		this.name = 'PayMethodError';
		this.code = code;
	}
}

/** What a stored method may carry over: the owner's name for it, and (from older versions) the bank it was saved as. */
interface StoredQr {
	label?: unknown;
	institution?: unknown;
	/** The wallet tile chosen in the version before the registry: gcash, maya, maribank or null. */
	provider?: unknown;
}

/**
 * A QR method from a validated payload. The bank comes from the QR itself, by
 * the registry; a stored bank only fills in where the QR cannot name one (see
 * storedInstitution). The label is the owner's name for it, else the bank's.
 */
function qrMethod(id: string, qr: PayQr, stored: StoredQr = {}): QrMethod {
	const { bic, institution: known } = qrBankOf(qr.payload);
	const institution = known ?? storedInstitution(stored.institution) ?? storedInstitution(stored.provider);
	// A stored fallback name is not the owner's choice: it gives way once the bank is known.
	const own = parseMethodLabel(stored.label);
	const label = own.ok && own.label && own.label !== FALLBACK_QR_LABEL ? own.label : defaultQrLabel(institution);
	return {
		id,
		kind: 'qr',
		...(bic ? { bic } : {}),
		...(institution ? { institution: institution.id } : {}),
		label,
		...qr
	};
}

/**
 * An EMVCo payload becomes a QR method; an allow-listed https link (as Venmo or Cash App QR codes hold) a link method.
 */
export async function methodFromImage(input: Uint8Array, newId: () => string): Promise<PayMethod> {
	// Loaded here so pages that only read methods never load sharp and jsQR.
	const { decodeQrImage } = await import('./pay-qr-image');
	const text = (await decodeQrImage(input))?.trim();
	if (!text) throw new PayMethodError('not_qr');
	if (text.startsWith('000201')) {
		const r = validatePayQr(text);
		if (!r.ok) throw new PayMethodError(r.code);
		return qrMethod(newId(), r.value);
	}
	const link = parsePayLink(text);
	if (!link.ok) throw new PayMethodError('not_payment');
	return { id: newId(), kind: 'link', provider: link.provider, url: link.url };
}

export function methodFromLink(input: string, newId: () => string): LinkMethod {
	const link = parsePayLink(input);
	if (!link.ok) throw new PayMethodError(link.code);
	return { id: newId(), kind: 'link', provider: link.provider, url: link.url };
}

const sameMethod = (a: PayMethod, b: PayMethod) =>
	a.kind === 'qr' ? b.kind === 'qr' && a.payload === b.payload : b.kind === 'link' && a.url === b.url;

export function addPayMethod(list: PayMethod[], method: PayMethod): PayMethod[] {
	if (list.length >= MAX_PAY_METHODS) throw new PayMethodError('too_many');
	if (list.some((m) => sameMethod(m, method))) throw new PayMethodError('duplicate');
	return [...list, method];
}

/** Null when no method has that id. */
export function removePayMethod(list: PayMethod[], id: string): PayMethod[] | null {
	const next = list.filter((m) => m.id !== id);
	return next.length === list.length ? null : next;
}

/** Null unless `order` lists every method id exactly once. */
export function reorderPayMethods(list: PayMethod[], order: unknown): PayMethod[] | null {
	if (!Array.isArray(order) || order.length !== list.length || new Set(order).size !== order.length) return null;
	const byId = new Map(list.map((m) => [m.id, m]));
	const out: PayMethod[] = [];
	for (const id of order) {
		const m = typeof id === 'string' ? byId.get(id) : undefined;
		if (!m) return null;
		out.push(m);
	}
	return out;
}

/**
 * Gives a QR method the owner's own name; an empty name puts the default back.
 * Null when no QR method has that id. Throws for a name that is not plain text
 * of up to 24 characters.
 */
export function renamePayMethod(list: PayMethod[], id: string, raw: unknown): PayMethod[] | null {
	const i = list.findIndex((m) => m.id === id && m.kind === 'qr');
	if (i < 0) return null;
	const r = parseMethodLabel(raw);
	if (!r.ok) throw new PayMethodError('bad_label');
	const { id: _id, payload, name, city, country, currency, institution } = list[i] as QrMethod;
	const next = [...list];
	next[i] = qrMethod(id, { payload, name, city, country, currency }, { label: r.label, institution });
	return next;
}

/** Methods as the public page may show them: everything but the QR payload (and the BIC, which payers do not need). */
export function publicPayMethods(list: PayMethod[]): PublicPayMethod[] {
	return list.map((m) => {
		if (m.kind === 'link') return m;
		const { payload: _payload, bic: _bic, ...rest } = m;
		return rest;
	});
}

const isText = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

/**
 * Methods from the stored Json column. Re-checks each entry, so a stored value
 * that no longer validates is never shown to payers.
 */
export function readPayMethods(raw: unknown): PayMethod[] {
	if (!Array.isArray(raw)) return [];
	const out: PayMethod[] = [];
	for (const m of raw) {
		if (!m || typeof m !== 'object' || !isText(m.id)) continue;
		if (m.kind === 'qr' && isText(m.payload)) {
			const r = validatePayQr(m.payload);
			if (r.ok) out.push(qrMethod(m.id, r.value, m));
		} else if (m.kind === 'link' && isText(m.url)) {
			const r = parsePayLink(m.url);
			if (r.ok && r.provider in PROVIDER_NAMES) {
				out.push({ id: m.id, kind: 'link', provider: r.provider as PayProvider, url: r.url });
			}
		}
	}
	return out.slice(0, MAX_PAY_METHODS);
}
