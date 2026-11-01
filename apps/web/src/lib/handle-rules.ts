// What a NEW handle may be. Shared by the claim endpoint and the claim page.
// A new handle must be a valid subdomain label, so every profile can have
// <handle>.iksi.app: lowercase letters, numbers and hyphens, no hyphen at
// either end. Handles claimed before this rule (some have underscores) are
// never re-checked: lookups and routing still accept them.

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 30;

export const HANDLE_ERRORS = {
	required: 'Handle required',
	length: `Use ${HANDLE_MIN} to ${HANDLE_MAX} characters.`,
	chars: 'Use letters, numbers and hyphens. No underscores.',
	hyphen: "A handle can't start or end with a hyphen."
} as const;

/** Why `input` cannot be claimed as a new handle, or null when its shape is fine. Reserved names are checked on the server. */
export function handleShapeError(input: string): string | null {
	if (!input) return HANDLE_ERRORS.required;
	if (!/^[a-z0-9-]+$/.test(input)) return HANDLE_ERRORS.chars;
	if (input.startsWith('-') || input.endsWith('-')) return HANDLE_ERRORS.hyphen;
	if (input.length < HANDLE_MIN || input.length > HANDLE_MAX) return HANDLE_ERRORS.length;
	return null;
}
