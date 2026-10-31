import { describe, it, expect, vi, afterEach } from 'vitest';
import sharp from 'sharp';

const h = vi.hoisted(() => ({ avatarUrl: '' as string }));

vi.mock('#lib/prisma.js', () => ({
	prisma: {
		handle: {
			findUnique: vi.fn(async () => ({
				user: {
					profile: {
						displayName: 'Ann Lee',
						accent: '#3B82F6',
						theme: 'light',
						bio: null,
						avatarUrl: h.avatarUrl
					}
				}
			}))
		}
	}
}));

import { GET } from './+server';

async function webp(colour: string) {
	return await sharp({ create: { width: 200, height: 200, channels: 3, background: colour } })
		.webp()
		.toBuffer();
}

async function render() {
	const res = await GET({ params: { handle: 'ann' } } as any);
	expect(res.status).toBe(200);
	const out = sharp(Buffer.from(await res.arrayBuffer()));
	const { data, info } = await out.raw().toBuffer({ resolveWithObject: true });
	return { data, info };
}

// Avatar circle is centred horizontally; sample inside it.
function pixel(data: Buffer, info: { width: number; channels: number }, x: number, y: number) {
	const i = (y * info.width + x) * info.channels;
	return [data[i], data[i + 1], data[i + 2]];
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('og avatar', () => {
	it('draws a CDN WebP avatar (converted to PNG)', async () => {
		h.avatarUrl = 'https://cdn.iksi.app/1/avatar/x.400.webp';
		const bytes = await webp('#ff0000');
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(bytes, { headers: { 'content-type': 'image/webp' } }))
		);
		const { data, info } = await render();
		const [r, g, b] = pixel(data, info, 600, 200);
		expect(r).toBeGreaterThan(200);
		expect(g).toBeLessThan(60);
		expect(b).toBeLessThan(60);
	}, 30000);

	it('falls back to initials and logs when the fetch fails', async () => {
		h.avatarUrl = 'https://cdn.iksi.app/1/avatar/x.400.webp';
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('boom'); }));
		const { data, info } = await render();
		expect(err).toHaveBeenCalled();
		const [r, g, b] = pixel(data, info, 600, 200);
		// not the avatar red
		expect(r > 200 && g < 60 && b < 60).toBe(false);
	}, 30000);
});
