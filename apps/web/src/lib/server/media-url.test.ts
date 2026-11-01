import { afterEach, describe, expect, it } from 'vitest';
import { isMediaKey, mediaUrl } from './media-url';

const saved = process.env.MEDIA_BASE_URL;
afterEach(() => {
	if (saved === undefined) delete process.env.MEDIA_BASE_URL;
	else process.env.MEDIA_BASE_URL = saved;
});

const KEY = '7/avatar/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.400.webp';

describe('mediaUrl', () => {
	it('rewrites a cdn.iksi.app url onto MEDIA_BASE_URL', () => {
		process.env.MEDIA_BASE_URL = 'https://www.iksi.app/media';
		expect(mediaUrl(`https://cdn.iksi.app/${KEY}`)).toBe(`https://www.iksi.app/media/${KEY}`);
	});

	it('ignores a trailing slash on MEDIA_BASE_URL', () => {
		process.env.MEDIA_BASE_URL = 'https://www.iksi.app/media/';
		expect(mediaUrl(`https://cdn.iksi.app/${KEY}`)).toBe(`https://www.iksi.app/media/${KEY}`);
	});

	it.each([
		'https://lh3.googleusercontent.com/a/abc=s400-c',
		'https://pbs.twimg.com/profile_images/1/x_400x400.jpg',
		'https://example.com/cdn.iksi.app/a.png',
		'https://cdn.iksi.app.evil.com/a.png',
		`https://www.iksi.app/media/${KEY}`
	])('leaves %s untouched', (url) => {
		process.env.MEDIA_BASE_URL = 'https://www.iksi.app/media';
		expect(mediaUrl(url)).toBe(url);
	});

	it('passes null through', () => {
		process.env.MEDIA_BASE_URL = 'https://www.iksi.app/media';
		expect(mediaUrl(null)).toBeNull();
	});

	it('is a no-op when MEDIA_BASE_URL is unset', () => {
		delete process.env.MEDIA_BASE_URL;
		expect(mediaUrl(`https://cdn.iksi.app/${KEY}`)).toBe(`https://cdn.iksi.app/${KEY}`);
	});
});

describe('isMediaKey', () => {
	it.each([
		KEY,
		'12/avatar/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.96.webp',
		'12/background/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.1600.webp'
	])('accepts %s', (key) => expect(isMediaKey(key)).toBe(true));

	it.each([
		'',
		'../7/avatar/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.400.webp',
		'7/../avatar/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.400.webp',
		'x/7/avatar/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.400.webp',
		'7/avatar/extra/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.400.webp',
		'7/banner/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.400.webp',
		'7/avatar/not-a-uuid.400.webp',
		'7/avatar/0B9F1C2E-3D4A-4B5C-8D6E-7F8091A2B3C4.400.webp',
		'7/avatar/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.400.png',
		'7/avatar/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.1600.webp',
		'7/background/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.400.webp',
		'7/avatar/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.webp',
		`${KEY}/`,
		`/${KEY}`
	])('rejects %j', (key) => expect(isMediaKey(key)).toBe(false));
});
