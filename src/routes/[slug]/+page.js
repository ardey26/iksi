import { error, redirect } from '@sveltejs/kit';
import { prisma } from '$lib/prisma.js';
import { decodeURL } from '$lib/utils/crypto.js';

export const load = async ({ params }) => {
	const longURL = await prisma.longURL.findFirst({
		where: {
			shortURL: params.slug
		},
		select: {
			originalURL: true
		}
	});

	if (!longURL) {
		throw error(404, 'not found');
	}

	const decodedURL = await decodeURL(longURL.originalURL);
	throw redirect(302, decodedURL);
};
