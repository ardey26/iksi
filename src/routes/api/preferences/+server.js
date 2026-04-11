import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma.js';

/**
 * PATCH /api/preferences - Update user preferences
 */
export const PATCH = async ({ request, locals, cookies }) => {
	const body = await request.json();
	const { showPreview } = body;

	if (typeof showPreview !== 'boolean') {
		return json(
			{ error: { code: 'INVALID_VALUE', message: 'showPreview must be a boolean' } },
			{ status: 400 }
		);
	}

	if (locals.user) {
		// Signed-in user: update database
		await prisma.user.update({
			where: { id: locals.user.id },
			data: { showPreview }
		});
	} else {
		// Anonymous: set cookie
		cookies.set('iksi_preview_pref', String(showPreview), {
			path: '/',
			httpOnly: false, // Allow JS to read it
			secure: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 365 // 1 year
		});
	}

	return json({ success: true, showPreview });
};

/**
 * GET /api/preferences - Get current preferences
 */
export const GET = async ({ locals, cookies }) => {
	let showPreview = false;

	if (locals.user) {
		showPreview = locals.user.showPreview;
	} else {
		showPreview = cookies.get('iksi_preview_pref') === 'true';
	}

	return json({ showPreview });
};
