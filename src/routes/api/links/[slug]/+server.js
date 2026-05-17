import { json } from '@sveltejs/kit';
import { prisma } from '$lib/prisma.js';
import { decodeURL, encodeURL } from '$lib/server/crypto.js';
import { addPrefix, isValidURLServer } from '$lib/utils/urlValidation.js';
import { createURLHash } from '$lib/utils/urlHash.js';

/**
 * GET /api/links/[slug] - Public metadata lookup
 */
export const GET = async ({ params }) => {
	const link = await prisma.longURL.findFirst({
		where: {
			shortURL: params.slug,
			deletedAt: null
		},
		select: {
			shortURL: true,
			originalURL: true,
			showPreview: true,
			safeBrowsing: true,
			createdAt: true,
			_count: {
				select: { clicks: true }
			}
		}
	});

	if (!link) {
		return json(
			{ error: { code: 'NOT_FOUND', message: 'Link not found' } },
			{ status: 404 }
		);
	}

	const destinationURL = await decodeURL(link.originalURL);

	return json({
		slug: link.shortURL,
		destinationURL,
		showPreview: link.showPreview,
		safeBrowsing: link.safeBrowsing,
		createdAt: link.createdAt.toISOString(),
		clicks: link._count.clicks
	});
};

/**
 * PATCH /api/links/[slug] - Update link (owner only)
 */
export const PATCH = async ({ params, request, locals }) => {
	if (!locals.user) {
		return json(
			{ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
			{ status: 401 }
		);
	}

	const link = await prisma.longURL.findFirst({
		where: {
			shortURL: params.slug,
			deletedAt: null
		},
		select: {
			id: true,
			ownerId: true
		}
	});

	if (!link) {
		return json(
			{ error: { code: 'NOT_FOUND', message: 'Link not found' } },
			{ status: 404 }
		);
	}

	if (link.ownerId !== locals.user.id) {
		return json(
			{ error: { code: 'FORBIDDEN', message: 'You do not own this link' } },
			{ status: 403 }
		);
	}

	const body = await request.json();
	const { url, showPreview, listed } = body;

	const updateData = {};

	// Update URL if provided
	if (url !== undefined) {
		if (typeof url !== 'string' || url.length > 2048) {
			return json(
				{ error: { code: 'INVALID_URL', message: 'Invalid URL' } },
				{ status: 400 }
			);
		}

		const prefixedURL = addPrefix(url.trim());

		if (!isValidURLServer(prefixedURL)) {
			return json(
				{ error: { code: 'INVALID_URL', message: 'Invalid URL provided' } },
				{ status: 400 }
			);
		}

		const urlHash = await createURLHash(prefixedURL);
		const encodedURL = encodeURL(prefixedURL);

		updateData.originalURL = encodedURL;
		updateData.urlHash = urlHash;
		updateData.safeBrowsing = 'UNCHECKED'; // Reset on URL change
	}

	// Update showPreview if provided
	if (showPreview !== undefined) {
		if (typeof showPreview !== 'boolean') {
			return json(
				{ error: { code: 'INVALID_VALUE', message: 'showPreview must be a boolean' } },
				{ status: 400 }
			);
		}
		updateData.showPreview = showPreview;
	}

	// Update listed if provided
	if (listed !== undefined) {
		if (typeof listed !== 'boolean') {
			return json(
				{ error: { code: 'INVALID_VALUE', message: 'listed must be a boolean' } },
				{ status: 400 }
			);
		}
		updateData.listed = listed;
	}

	if (Object.keys(updateData).length === 0) {
		return json(
			{ error: { code: 'NO_CHANGES', message: 'No valid fields to update' } },
			{ status: 400 }
		);
	}

	const updated = await prisma.longURL.update({
		where: { id: link.id },
		data: updateData,
		select: {
			shortURL: true,
			originalURL: true,
			showPreview: true,
			listed: true,
			safeBrowsing: true
		}
	});

	const destinationURL = await decodeURL(updated.originalURL);

	return json({
		slug: updated.shortURL,
		destinationURL,
		showPreview: updated.showPreview,
		listed: updated.listed,
		safeBrowsing: updated.safeBrowsing
	});
};

/**
 * DELETE /api/links/[slug] - Soft delete link (owner only)
 */
export const DELETE = async ({ params, locals }) => {
	if (!locals.user) {
		return json(
			{ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
			{ status: 401 }
		);
	}

	const link = await prisma.longURL.findFirst({
		where: {
			shortURL: params.slug,
			deletedAt: null
		},
		select: {
			id: true,
			ownerId: true
		}
	});

	if (!link) {
		return json(
			{ error: { code: 'NOT_FOUND', message: 'Link not found' } },
			{ status: 404 }
		);
	}

	if (link.ownerId !== locals.user.id) {
		return json(
			{ error: { code: 'FORBIDDEN', message: 'You do not own this link' } },
			{ status: 403 }
		);
	}

	await prisma.longURL.update({
		where: { id: link.id },
		data: { deletedAt: new Date() }
	});

	return json({ success: true });
};
