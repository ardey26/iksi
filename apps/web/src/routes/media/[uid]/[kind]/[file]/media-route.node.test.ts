import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock('#lib/server/media-store.js', () => ({
	r2MediaStore: () => ({ get: h.get, put: vi.fn(), deletePrefix: vi.fn(), publicUrl: (k: string) => k })
}));

import { GET } from './+server';

const KEY = '7/avatar/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.400.webp';
const FOREVER = 'public, max-age=31536000, immutable';

// Params as the router hands them over: one segment each, already decoded.
function call(key: string) {
	const [uid, kind, file] = key.split('/');
	return callParams({ uid, kind, file });
}
function callParams(params: { uid: string; kind: string; file: string }) {
	return GET({ params } as any);
}

function stream(bytes: Uint8Array) {
	return new Response(bytes).body!;
}

beforeEach(() => {
	h.get.mockReset();
});

describe('GET /media/[uid]/[kind]/[file]', () => {
	it('streams a stored object with forever cache headers', async () => {
		h.get.mockResolvedValue({ body: stream(new Uint8Array([1, 2, 3])), contentType: 'image/webp', contentLength: 3 });
		const res = await call(KEY);
		expect(h.get).toHaveBeenCalledWith(KEY);
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('image/webp');
		expect(res.headers.get('content-length')).toBe('3');
		expect(res.headers.get('cache-control')).toBe(FOREVER);
		expect(res.headers.get('cdn-cache-control')).toBe(FOREVER);
		expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
	});

	it('falls back to image/webp when R2 has no content type', async () => {
		h.get.mockResolvedValue({ body: stream(new Uint8Array([1])), contentType: undefined });
		const res = await call('7/background/0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4.1600.webp');
		expect(res.status).toBe(200);
		expect(res.headers.get('content-type')).toBe('image/webp');
	});

	const UUID = '0b9f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4';
	it.each([
		{ uid: '..', kind: 'avatar', file: `${UUID}.400.webp` },
		{ uid: 'x', kind: 'avatar', file: `${UUID}.400.webp` },
		{ uid: '7', kind: '..', file: `${UUID}.400.webp` },
		{ uid: '7', kind: 'banner', file: `${UUID}.400.webp` },
		{ uid: '7', kind: 'avatar', file: 'not-a-uuid.400.webp' },
		{ uid: '7', kind: 'avatar', file: `${UUID}.400.png` },
		{ uid: '7', kind: 'background', file: `${UUID}.400.webp` },
		// An encoded slash decodes into the param; the rebuilt key then has four segments.
		{ uid: '7', kind: 'avatar', file: `extra/${UUID}.400.webp` },
		{ uid: '7', kind: 'avatar', file: '..' }
	])('404s %j without asking the store', async (params) => {
		const res = await callParams(params);
		expect(res.status).toBe(404);
		expect(h.get).not.toHaveBeenCalled();
	});

	it('404s a missing object with a short cache', async () => {
		h.get.mockResolvedValue(null);
		const res = await call(KEY);
		expect(res.status).toBe(404);
		expect(res.headers.get('cache-control')).toBe('public, max-age=60');
		expect(res.headers.get('cdn-cache-control')).toBeNull();
	});

	it('answers 502, uncached, and logs when R2 fails', async () => {
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		h.get.mockRejectedValue(new Error('r2 down'));
		const res = await call(KEY);
		expect(res.status).toBe(502);
		expect(res.headers.get('cache-control')).toBe('no-store');
		expect(err).toHaveBeenCalled();
		err.mockRestore();
	});
});
