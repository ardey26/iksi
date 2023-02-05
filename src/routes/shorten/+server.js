/* eslint-disable no-useless-escape */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const generateShortURL = async () => {
	const availableChars = 'Iifk1eM5ZLAnXNajCh7olzPrGsKVwmRQStB0FgYUxDcJqWTbOv3p9Ed82uyH46';
	let shortURL = '';

	const lengthOfShortUrl = 8;

	for (let i = 0; i < lengthOfShortUrl; i++) {
		const randomIndex = Math.floor(Math.random() * availableChars.length);
		const randomChar = availableChars[randomIndex];

		shortURL += randomChar;
	}

	const hasCollision = await prisma.longURL.findFirst({
		where: {
			shortURL: shortURL
		}
	});

	if (hasCollision) {
		generateShortURL();
	}

	return shortURL;
};

// prefixes with https by default
const addPrefix = (url) => {
	if (!url.startsWith('http://') && !url.startsWith('https://')) {
		return 'https://' + url;
	}

	return url;
};

const isValidURL = (prefixedURL) => {
	const pattern =
		/^(http:\/\/|https:\/\/)?[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,5}(:[0-9]{1,5})?(\/.*)?$/;

	return pattern.test(prefixedURL);
};
export const POST = async ({ request }) => {
	const { longURL } = await request.json();

	const prefixedURL = addPrefix(longURL);

	if (!isValidURL(prefixedURL)) {
		return new Response(JSON.stringify({ error: 'provide a valid URL' }));
	}

	const isShortened = await prisma.longURL.findFirst({
		where: {
			originalURL: prefixedURL
		}
	});

	if (isShortened) {
		return new Response(JSON.stringify({ message: isShortened.shortURL }));
	}

	const url = await prisma.longURL.create({
		data: {
			originalURL: prefixedURL,
			shortURL: await generateShortURL()
		}
	});
	return new Response(JSON.stringify({ message: url.shortURL }));
};
