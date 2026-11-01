// Uploaded images were first served from cdn.iksi.app (Cloudflare). They are
// now served by the app at MEDIA_BASE_URL (e.g. https://www.iksi.app/media),
// because some Philippine ISPs cannot reach Cloudflare reliably. Rows written
// before the switch still hold cdn.iksi.app URLs, so they are rewritten when
// read rather than migrated. Kept free of sharp and the AWS SDK so the image
// route stays light.

export const LEGACY_MEDIA_BASE = 'https://cdn.iksi.app';

export function mediaBase(): string {
	return (process.env.MEDIA_BASE_URL || LEGACY_MEDIA_BASE).replace(/\/+$/, '');
}

export function mediaUrl(url: string): string;
export function mediaUrl(url: string | null): string | null;
export function mediaUrl(url: string | null): string | null {
	if (!url) return url;
	const base = process.env.MEDIA_BASE_URL?.replace(/\/+$/, '');
	const legacy = `${LEGACY_MEDIA_BASE}/`;
	if (!base || !url.startsWith(legacy)) return url;
	return `${base}/${url.slice(legacy.length)}`;
}

// The only key shapes uploads write: mediaBaseKey + variantKey in media.ts,
// with the variant names processImage produces for each kind.
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const MEDIA_KEY = new RegExp(`^\\d+/(?:avatar/${UUID}\\.(?:400|96)|background/${UUID}\\.1600)\\.webp$`);

export function isMediaKey(key: string): boolean {
	return MEDIA_KEY.test(key);
}
