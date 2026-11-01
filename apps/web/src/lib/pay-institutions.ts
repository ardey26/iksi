// The banks and e-wallets a payment QR can be recognised as. Shared by the
// server, which works out which bank a QR is for, and the pages, which show
// its logo. The dashboard never lists banks: the QR names its own.
//
// Adding a bank is one entry in BY_BIC. Only add a BIC that has been read off
// a real QR from that bank; a guessed one would put the wrong logo on a payer's
// screen.

export interface Institution {
	/** Stable id, saved with each method. Never change one once shipped. */
	id: string;
	name: string;
	/** A trademark, shown only to say which app the QR is for. Banks without one get a monogram. */
	logo?: string;
	/** Natural aspect of the logo, as width / height. 1 when unset. */
	aspect?: number;
	/** The logo already spells the name, so it is set smaller to look the same weight as a round mark. */
	wordmark?: boolean;
}

/** Keyed by the BIC in sub-tag 01 of a QR Ph merchant account template (tags 26–51). */
const BY_BIC: Record<string, Institution> = {
	GXCHPHM2XXX: { id: 'gcash', name: 'GCash', logo: '/brands/gcash.svg', aspect: 72 / 61 },
	LAUIPHM2XXX: { id: 'maribank', name: 'MariBank', logo: '/brands/maribank.png', aspect: 152 / 128 }
};

/**
 * Banks whose BIC is not confirmed, known only when a merchant account GUID
 * spells out their name as a word of its own ("com.paymaya", "ph.maya.qr").
 * Never matched against the account holder's name (tag 59): Maya is a common
 * first name, so "MAYA SANTOS" says nothing about the bank.
 */
const BY_GUID: { pattern: RegExp; institution: Institution }[] = [
	{
		pattern: /(^|[^a-z0-9])(pay)?maya([^a-z0-9]|$)/i,
		institution: { id: 'maya', name: 'Maya', logo: '/brands/maya.svg', aspect: 112 / 33, wordmark: true }
	}
];

const BIC_MAP = new Map(Object.entries(BY_BIC));
const BY_ID = new Map<string, Institution>(
	[...Object.values(BY_BIC), ...BY_GUID.map((m) => m.institution)].map((i) => [i.id, i])
);
const BIC_KEYED = new Set(Object.values(BY_BIC).map((i) => i.id));

/** What an unknown bank's QR is called until its owner renames it. */
export const FALLBACK_QR_LABEL = 'Bank QR';

/** One merchant account template of a QR: its GUID (sub-tag 00) and BIC (sub-tag 01), if any. */
export interface QrAccount {
	guid: string;
	bic: string | null;
}

const BIC_SHAPE = /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/;

/** "GXCHPHM2XXX" for " gxchphm2 ". Null for text that is not shaped like a BIC. */
export function normalizeBic(v: string | null | undefined): string | null {
	const bic = (v ?? '').trim().toUpperCase();
	if (!BIC_SHAPE.test(bic)) return null;
	return bic.length === 8 ? `${bic}XXX` : bic;
}

/** The bank a QR is for: by BIC first, then by a GUID that names it. Null when unknown. */
export function identifyInstitution(accounts: QrAccount[]): Institution | null {
	for (const a of accounts) {
		const bic = normalizeBic(a.bic);
		const hit = bic ? BIC_MAP.get(bic) : undefined;
		if (hit) return hit;
	}
	for (const a of accounts) {
		const hit = BY_GUID.find((m) => m.pattern.test(a.guid));
		if (hit) return hit.institution;
	}
	return null;
}

export function institutionById(id: unknown): Institution | null {
	return typeof id === 'string' ? (BY_ID.get(id) ?? null) : null;
}

/**
 * The bank a stored method names, used only when its QR does not name one.
 * A bank known by BIC is always recognised from its own QR, so a stored claim
 * to be one is never trusted; a bank known only by marker may have been named
 * by the owner in an earlier version, and keeps that name.
 */
export function storedInstitution(id: unknown): Institution | null {
	const i = institutionById(id);
	return i && !BIC_KEYED.has(i.id) ? i : null;
}

export function defaultQrLabel(institution: Institution | null): string {
	return institution?.name ?? FALLBACK_QR_LABEL;
}

/** The badge letter for a method without a logo: the label's first letter or digit. */
export function monogramOf(label: string): string {
	const ch = label.match(/[\p{L}\p{N}]/u)?.[0];
	return ch ? ch.toLocaleUpperCase('en') : '?';
}
