// Building and editing a profile's payment methods. Nothing here touches the
// media store: an uploaded QR image is decoded in memory and discarded.
import {
	MAX_PAY_METHODS,
	parseQrProvider,
	PROVIDER_NAMES,
	QR_PROVIDER_INFO,
	type LinkMethod,
	type PayMethod,
	type PayProvider,
	type PublicPayMethod,
	type QrProvider
} from '#lib/pay-methods.js';
import { PAY_QR_ERROR_TEXT, qrProviderOf, validatePayQr, type PayQrErrorCode } from './pay-qr';
import { PAY_LINK_ERROR_TEXT, parsePayLink, type PayLinkErrorCode } from './pay-links';

export type PayMethodErrorCode = PayQrErrorCode | PayLinkErrorCode | 'too_many' | 'duplicate';

const LIST_ERROR_TEXT = {
	too_many: `You can add up to ${MAX_PAY_METHODS} payment methods. Remove one to add another.`,
	duplicate: 'That payment method is already on your profile.'
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

/**
 * The QR's BIC decides when it is known. Real GCash and MariBank QRs always
 * carry theirs, so an unknown BIC with either chosen means another bank.
 * Maya's BIC is unconfirmed, so a Maya QR relies on the owner's choice.
 */
const providerFor = (payload: string, chosen: QrProvider | null) =>
	qrProviderOf(payload) ?? (chosen === 'maya' ? 'maya' : null);

/**
 * An EMVCo payload becomes a QR method; an allow-listed https link (as Venmo or Cash App QR codes hold) a link method.
 * `chosen` is the wallet tile the owner tapped, null for the generic upload.
 */
export async function methodFromImage(input: Uint8Array, newId: () => string, chosen: QrProvider | null = null): Promise<PayMethod> {
	// Loaded here so pages that only read methods never load sharp and jsQR.
	const { decodeQrImage } = await import('./pay-qr-image');
	const text = (await decodeQrImage(input))?.trim();
	if (!text) throw new PayMethodError('not_qr');
	if (text.startsWith('000201')) {
		const r = validatePayQr(text);
		if (!r.ok) throw new PayMethodError(r.code);
		return { id: newId(), kind: 'qr', provider: providerFor(text, chosen), ...r.value };
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

/** Tells the owner when the QR turned out not to be for the wallet tile they tapped. */
export function providerNotice(chosen: QrProvider | null, method: PayMethod): string | null {
	if (!chosen || method.kind !== 'qr' || method.provider === chosen) return null;
	if (!method.provider) return `This isn't a ${QR_PROVIDER_INFO[chosen].name} QR. Saved as a bank QR.`;
	const name = QR_PROVIDER_INFO[method.provider].name;
	return `This is a ${name} QR. Saved as ${name}.`;
}

/** Methods as the public page may show them: everything but the QR payload. */
export function publicPayMethods(list: PayMethod[]): PublicPayMethod[] {
	return list.map((m) => {
		if (m.kind === 'link') return m;
		const { payload: _payload, ...rest } = m;
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
			if (r.ok) out.push({ id: m.id, kind: 'qr', provider: providerFor(r.value.payload, parseQrProvider(m.provider)), ...r.value });
		} else if (m.kind === 'link' && isText(m.url)) {
			const r = parsePayLink(m.url);
			if (r.ok && r.provider in PROVIDER_NAMES) {
				out.push({ id: m.id, kind: 'link', provider: r.provider as PayProvider, url: r.url });
			}
		}
	}
	return out.slice(0, MAX_PAY_METHODS);
}
