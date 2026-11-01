import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { MAX_UPLOAD_BYTES, MediaError, mediaBaseKey, processImage, variantKey } from './media';
import { isMediaKey } from './media-url';

const solid = { create: { background: '#336699', channels: 3 as const } };

function png(width: number, height: number) {
	return sharp({ create: { width, height, ...solid.create } })
		.png()
		.toBuffer();
}
function jpeg(width: number, height: number) {
	return sharp({ create: { width, height, ...solid.create } })
		.jpeg()
		.toBuffer();
}
async function codeOf(p: Promise<unknown>) {
	try {
		await p;
	} catch (e) {
		expect(e).toBeInstanceOf(MediaError);
		return (e as MediaError).code;
	}
	return 'no error';
}

describe('processImage', () => {
	it('makes avatar variants 400 and 96', async () => {
		const out = await processImage(await png(1200, 800), 'avatar');
		expect(out.map((v) => v.name)).toEqual(['400', '96']);
		for (const [v, size] of [
			[out[0], 400],
			[out[1], 96]
		] as const) {
			const m = await sharp(v.bytes).metadata();
			expect(m.format).toBe('webp');
			expect([m.width, m.height]).toEqual([size, size]);
			expect([v.width, v.height]).toEqual([size, size]);
		}
	});

	it('fits backgrounds inside 1600 and never upscales', async () => {
		const [big] = await processImage(await jpeg(3000, 2000), 'background');
		expect(big.name).toBe('1600');
		expect([big.width, big.height]).toEqual([1600, 1067]);
		const [small] = await processImage(await jpeg(800, 600), 'background');
		expect([small.width, small.height]).toEqual([800, 600]);
	});

	it('applies EXIF orientation and strips exif', async () => {
		const input = await sharp({ create: { width: 1000, height: 500, ...solid.create } })
			.jpeg()
			.withMetadata({ orientation: 6 })
			.toBuffer();
		expect((await sharp(input).metadata()).orientation).toBe(6);
		const [v] = await processImage(input, 'background');
		const m = await sharp(v.bytes).metadata();
		expect([m.width, m.height]).toEqual([500, 1000]);
		expect(m.exif).toBeUndefined();
	});

	it('rejects non-images and truncated files as unsupported', async () => {
		expect(await codeOf(processImage(new TextEncoder().encode('not an image'), 'avatar'))).toBe(
			'unsupported'
		);
		const full = await jpeg(600, 600);
		const half = full.subarray(0, Math.floor(full.length / 2));
		expect(await codeOf(processImage(half, 'avatar'))).toBe('unsupported');
	});

	it('rejects oversized dimensions', async () => {
		expect(await codeOf(processImage(await png(9000, 10), 'background'))).toBe('too_many_pixels');
	});

	it('rejects empty and too-large input', async () => {
		expect(await codeOf(processImage(new Uint8Array(0), 'avatar'))).toBe('empty');
		expect(await codeOf(processImage(new Uint8Array(MAX_UPLOAD_BYTES + 1), 'avatar'))).toBe(
			'too_large'
		);
	});
});

describe('format allowlist and formats', () => {
	it('rejects SVG and TIFF', async () => {
		const svg = new TextEncoder().encode(
			'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>'
		);
		expect(await codeOf(processImage(svg, 'avatar'))).toBe('unsupported');
		const tiff = await sharp({ create: { width: 20, height: 20, ...solid.create } })
			.tiff()
			.toBuffer();
		expect(await codeOf(processImage(tiff, 'avatar'))).toBe('unsupported');
	});

	it('accepts WebP and AVIF', async () => {
		const base = { create: { width: 300, height: 200, ...solid.create } };
		for (const input of [
			await sharp(base).webp().toBuffer(),
			await sharp(base).avif().toBuffer()
		]) {
			const [v] = await processImage(input, 'avatar');
			const m = await sharp(v.bytes).metadata();
			expect([m.format, m.width, m.height]).toEqual(['webp', 400, 400]);
		}
	});

	it('uses only the first frame of an animated GIF', async () => {
		const frames = await Promise.all(
			['#ff0000', '#00ff00', '#0000ff'].map((background) =>
				sharp({ create: { width: 60, height: 40, channels: 3, background } })
					.png()
					.toBuffer()
			)
		);
		const raw = await Promise.all(frames.map((f) => sharp(f).ensureAlpha().raw().toBuffer()));
		const gif = await sharp(Buffer.concat(raw), {
			raw: { width: 60, height: 120, channels: 4, pageHeight: 40 }
		})
			.gif()
			.toBuffer();
		expect((await sharp(gif, { animated: true }).metadata()).pages).toBe(3);
		const [v] = await processImage(gif, 'background');
		const m = await sharp(v.bytes, { animated: true }).metadata();
		expect([m.pages ?? 1, m.width, m.height]).toEqual([1, 60, 40]);
	});
});

describe('keys', () => {
	it('builds base and variant keys', () => {
		expect(mediaBaseKey(7, 'avatar', 'u1')).toBe('7/avatar/u1');
		expect(variantKey('7/avatar/u1', '96')).toBe('7/avatar/u1.96.webp');
	});

	// The /media route serves only keys isMediaKey accepts; every key an upload writes must pass.
	it.each(['avatar', 'background'] as const)('every %s variant key is servable', async (kind) => {
		const base = mediaBaseKey(7, kind, crypto.randomUUID());
		for (const v of await processImage(await png(1200, 800), kind)) {
			expect(isMediaKey(variantKey(base, v.name))).toBe(true);
		}
	});
});

describe('unexpected failures', () => {
	it('logs a non-MediaError before mapping it to unsupported', async () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		const png = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#123' } })
			.png()
			.toBuffer();
		const truncated = new Uint8Array(png.subarray(0, Math.floor(png.length / 2)));
		await expect(processImage(truncated, 'avatar')).rejects.toMatchObject({ code: 'unsupported' });
		expect(err).toHaveBeenCalled();
		err.mockRestore();
	});
});
