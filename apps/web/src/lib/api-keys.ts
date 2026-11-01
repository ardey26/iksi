// API keys as the dashboard sees them. Safe to import from the browser.

/** Active keys a user can hold at once. */
export const MAX_API_KEYS = 10;
export const API_KEY_NAME_MAX = 40;

/**
 * "manual": made by hand in the dashboard and pasted somewhere.
 * "extension": made by the extension's "Connect to iksi" flow; a user has at
 * most one active, and connecting again replaces it.
 */
export type ApiKeyKind = 'manual' | 'extension';
export const EXTENSION_KEY_NAME = 'Chrome extension';

/** One key in the dashboard list. The key itself is shown once, at creation, and never again. */
export type ApiKeyView = {
	id: number;
	name: string;
	/** The key's first characters, e.g. "iksi_ab12". */
	prefix: string;
	kind: ApiKeyKind;
	createdAt: string;
	lastUsedAt: string | null;
};
