import { error, redirect } from '@sveltejs/kit';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const load = async ({ params }) => {
	const longURL = await prisma.longURL.findFirst({
		where: {
			shortURL: params.slug
		}
	});

	if (!longURL) {
		throw error(404, 'not found');
	}

	throw redirect(302, longURL.originalURL);
};
