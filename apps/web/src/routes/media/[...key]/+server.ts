// Serves uploaded images (avatars, backgrounds) from R2 through the app, so
// no visitor request depends on reaching Cloudflare. Keys are unique per
// upload and never rewritten, so a found object is cached for a year by both
// browsers and Vercel's CDN; the function runs once per key per region.
import type { RequestHandler } from './$types';
import { r2MediaStore } from '#lib/server/media-store.js';
import { isMediaKey } from '#lib/server/media-url.js';

const FOREVER = 'public, max-age=31536000, immutable';
// Short, so a key requested just before its upload lands is not stuck as 404.
const NOT_FOUND = 'public, max-age=60';

function notFound(): Response {
	return new Response('Not Found', { status: 404, headers: { 'cache-control': NOT_FOUND } });
}

export const GET: RequestHandler = async ({ params }) => {
	const key = params.key;
	if (!isMediaKey(key)) return notFound();

	let obj;
	try {
		obj = await r2MediaStore().get(key);
	} catch (err) {
		console.error('media: R2 read failed', key, err);
		return new Response('Bad Gateway', { status: 502, headers: { 'cache-control': 'no-store' } });
	}
	if (!obj) return notFound();

	const headers: Record<string, string> = {
		'content-type': obj.contentType || 'image/webp',
		'cache-control': FOREVER,
		'cdn-cache-control': FOREVER
	};
	if (obj.contentLength !== undefined) headers['content-length'] = String(obj.contentLength);
	return new Response(obj.body, { status: 200, headers });
};
