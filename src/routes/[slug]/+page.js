import { error, redirect } from '@sveltejs/kit';
import { prisma } from '../../lib/prisma.js';

export const load = async ({ params }) => {
	const longURL = await prisma.longURL.findUnique({
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

	throw redirect(302, longURL.originalURL);
};
