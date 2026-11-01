import { json } from '@sveltejs/kit';
import type { Prisma } from '@prisma/client';
import type { RequestHandler } from './$types';
import { purgeProfileOnSuccess } from '#lib/server/profile-cache.js';
import { verifyUserSession } from '#lib/server/user-auth.js';
import { rateLimit } from '#lib/rateLimit.js';
import { MAX_UPLOAD_BYTES, MEDIA_ERROR_TEXT, MediaError } from '#lib/server/media.js';
import {
	addPayMethod,
	methodFromImage,
	methodFromLink,
	PayMethodError,
	providerNotice,
	readPayMethods,
	removePayMethod,
	reorderPayMethods
} from '#lib/server/pay-methods.js';
import { parseQrProvider, payLabelOf, type PayLabel, type PayMethod } from '#lib/pay-methods.js';

// Payment methods behind the profile's Pay button. An uploaded QR image is
// decoded in memory and never stored; only what the QR holds is saved.

type Profile = { id: number; payMethods: unknown; payLabel: string | null; updatedAt: Date };

async function db() {
	return (await import('#lib/prisma.js')).prisma;
}

async function profileOf(uid: number): Promise<Profile | null> {
	return (await db()).profile.findUnique({
		where: { userId: uid },
		select: { id: true, payMethods: true, payLabel: true, updatedAt: true }
	});
}

/** Writes only if nothing changed the profile since it was read, so two tabs cannot exceed the limit. */
async function saveMethods(p: Profile, methods: PayMethod[]): Promise<boolean> {
	const { count } = await (await db()).profile.updateMany({
		where: { id: p.id, updatedAt: p.updatedAt },
		data: { payMethods: methods as unknown as Prisma.InputJsonValue }
	});
	return count === 1;
}

const view = (methods: PayMethod[], label: PayLabel, notice: string | null = null) => json({ methods, label, notice });
const changed = () => json({ error: 'Your payment methods changed in another tab. Reload and try again.' }, { status: 409 });
const noProfile = () => json({ error: 'No profile' }, { status: 404 });
const signedOut = () => json({ error: 'Not signed in' }, { status: 401 });

const handlePost: RequestHandler = async ({ request, cookies }) => {
	const uid = verifyUserSession(cookies.get('user_session'));
	if (uid === null) return signedOut();

	const rl = await rateLimit(`pay-methods:${uid}`, 30, 3_600_000);
	if (!rl.allowed) return json({ error: 'Too many changes. Try again later.' }, { status: 429 });

	let form: FormData;
	try {
		form = await request.formData();
	} catch {
		return json({ error: 'Invalid form data' }, { status: 400 });
	}

	const p = await profileOf(uid);
	if (!p) return noProfile();

	try {
		const newId = () => crypto.randomUUID();
		let method: PayMethod;
		// The wallet tile the owner tapped, if any. The QR's own BIC wins over it.
		const chosen = parseQrProvider(form.get('provider'));
		const kind = form.get('kind');
		if (kind === 'qr') {
			const file = form.get('file');
			if (!(file instanceof File)) return json({ error: 'File required' }, { status: 400 });
			if (file.size > MAX_UPLOAD_BYTES) throw new MediaError('too_large');
			method = await methodFromImage(new Uint8Array(await file.arrayBuffer()), newId, chosen);
		} else if (kind === 'link') {
			const url = form.get('url');
			method = methodFromLink(typeof url === 'string' ? url : '', newId);
		} else {
			return json({ error: 'Invalid kind' }, { status: 400 });
		}

		const methods = addPayMethod(readPayMethods(p.payMethods), method);
		if (!(await saveMethods(p, methods))) return changed();
		return view(methods, payLabelOf(p.payLabel), providerNotice(chosen, method));
	} catch (err) {
		if (err instanceof PayMethodError) return json({ error: err.message, code: err.code }, { status: 400 });
		if (err instanceof MediaError) return json({ error: MEDIA_ERROR_TEXT[err.code], code: err.code }, { status: 400 });
		throw err;
	}
};

const handleDelete: RequestHandler = async ({ url, cookies }) => {
	const uid = verifyUserSession(cookies.get('user_session'));
	if (uid === null) return signedOut();
	const p = await profileOf(uid);
	if (!p) return noProfile();

	const methods = removePayMethod(readPayMethods(p.payMethods), url.searchParams.get('id') ?? '');
	if (!methods) return json({ error: 'Not found' }, { status: 404 });
	if (!(await saveMethods(p, methods))) return changed();
	return view(methods, payLabelOf(p.payLabel));
};

const handlePatch: RequestHandler = async ({ request, cookies }) => {
	const uid = verifyUserSession(cookies.get('user_session'));
	if (uid === null) return signedOut();

	const body = await request.json().catch(() => ({}));

	// Order sets which method the Pay sheet shows first.
	if (typeof body === 'object' && body !== null && 'order' in body) {
		const p = await profileOf(uid);
		if (!p) return noProfile();
		const methods = reorderPayMethods(readPayMethods(p.payMethods), body.order);
		if (!methods || !(await saveMethods(p, methods))) return changed();
		return view(methods, payLabelOf(p.payLabel));
	}

	if (body?.label !== 'pay' && body?.label !== 'tip') return json({ error: 'Invalid label' }, { status: 400 });

	const p = await profileOf(uid);
	if (!p) return noProfile();
	await (await db()).profile.update({ where: { id: p.id }, data: { payLabel: body.label } });
	return view(readPayMethods(p.payMethods), body.label);
};

// Every successful change shows on the owner's public profile page; clear its cached copy.
export const POST: RequestHandler = purgeProfileOnSuccess(handlePost);
export const DELETE: RequestHandler = purgeProfileOnSuccess(handleDelete);
export const PATCH: RequestHandler = purgeProfileOnSuccess(handlePatch);
