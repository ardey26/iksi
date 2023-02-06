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

const isValidAlias = (customURL) => {
	const pattern = /^[a-zA-Z0-9-_]+$/;

	return pattern.test(customURL);
};
export const POST = async ({ request }) => {
	const { longURL, customURL } = await request.json();

	let shortURL;

	const prefixedURL = addPrefix(longURL);

	if (!isValidURL(prefixedURL)) {
		return new Response(JSON.stringify({ error: 'you provided an invalid URL' }));
	}

	if (customURL) {
		if (!isValidAlias(customURL)) {
			return new Response(JSON.stringify({ error: 'you provided an invalid alias' }));
		}

		const customURLExists = await prisma.longURL.findFirst({
			where: {
				shortURL: customURL
			}
		});

		if (customURLExists) {
			return new Response(
				JSON.stringify({ error: 'custom link alias already exists, pick another one' })
			);
		}

		shortURL = customURL;
	} else {
		const isShortened = await prisma.longURL.findFirst({
			where: {
				originalURL: prefixedURL
			}
		});

		if (isShortened) {
			return new Response(JSON.stringify({ message: isShortened.shortURL }));
		}

		shortURL = await generateShortURL();
	}

	const url = await prisma.longURL.create({
		data: {
			originalURL: prefixedURL.trim(),
			shortURL: shortURL.trim()
		}
	});
	return new Response(JSON.stringify({ message: url.shortURL }));
};
