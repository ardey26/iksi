import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { verifyUserSession } from '#lib/server/user-auth.js';
import { invalidateUserCache } from '#lib/server/user-cache.js';
import { rateLimit } from '#lib/rateLimit.js';
import { MAX_UPLOAD_BYTES, MediaError, type MediaKind } from '#lib/server/media.js';
import { r2MediaStore } from '#lib/server/media-store.js';
import { NoProfileError, prismaProfileMediaDb, removeMedia, replaceMedia } from '#lib/server/profile-media.js';

function parseKind(v: unknown): MediaKind | null {
	return v === 'avatar' || v === 'background' ? v : null;
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const uid = verifyUserSession(cookies.get('user_session'));
	if (uid === null) return json({ error: 'Not signed in' }, { status: 401 });

	const rl = await rateLimit(`media:${uid}`, 30, 3_600_000);
	if (!rl.allowed) return json({ error: 'Too many uploads' }, { status: 429 });

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return json({ error: 'Invalid form data' }, { status: 400 });
	}
	const kind = parseKind(form.get('kind'));
	if (!kind) return json({ error: 'Invalid kind' }, { status: 400 });
	const file = form.get('file');
	if (!(file instanceof File)) return json({ error: 'File required' }, { status: 400 });
	if (file.size > MAX_UPLOAD_BYTES) return json({ error: 'File too large', code: 'too_large' }, { status: 400 });

	try {
		const bytes = new Uint8Array(await file.arrayBuffer());
		const { url } = await replaceMedia(uid, kind, bytes, {
			db: prismaProfileMediaDb(),
			store: r2MediaStore(),
			newId: () => crypto.randomUUID()
		});
		if (kind === 'avatar') invalidateUserCache(uid);
		return json({ url });
	} catch (err) {
		if (err instanceof MediaError) return json({ error: err.message, code: err.code }, { status: 400 });
		if (err instanceof NoProfileError) return json({ error: 'No profile' }, { status: 404 });
		throw err;
	}
};

export const DELETE: RequestHandler = async ({ url, cookies }) => {
	const uid = verifyUserSession(cookies.get('user_session'));
	if (uid === null) return json({ error: 'Not signed in' }, { status: 401 });
	const kind = parseKind(url.searchParams.get('kind'));
	if (!kind) return json({ error: 'Invalid kind' }, { status: 400 });
	try {
		await removeMedia(uid, kind, { db: prismaProfileMediaDb(), store: r2MediaStore() });
	} catch (err) {
		if (err instanceof NoProfileError) return json({ error: 'No profile' }, { status: 404 });
		throw err;
	}
	if (kind === 'avatar') invalidateUserCache(uid);
	return new Response(null, { status: 204 });
};
