import { afterEach, describe, expect, it } from 'vitest';
import {
	DeleteObjectsCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand
} from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';
import { createR2Client, r2MediaStore } from '#lib/server/media-store.js';

function fakeClient(respond: (cmd: unknown) => unknown = () => ({})) {
	const sent: unknown[] = [];
	const client = {
		send: async (cmd: unknown) => {
			sent.push(cmd);
			return respond(cmd);
		}
	} as unknown as S3Client;
	return { client, sent };
}

const saved = { ...process.env };
afterEach(() => {
	process.env = { ...saved };
});

describe('r2MediaStore', () => {
	it('put sends PutObjectCommand with cache headers', async () => {
		delete process.env.R2_MEDIA_BUCKET;
		const { client, sent } = fakeClient();
		const bytes = new Uint8Array([1, 2, 3]);
		await r2MediaStore(client).put('7/avatar/u1.400.webp', bytes, 'image/webp');
		expect(sent).toHaveLength(1);
		expect(sent[0]).toBeInstanceOf(PutObjectCommand);
		expect((sent[0] as PutObjectCommand).input).toEqual({
			Bucket: 'iksi-media',
			Key: '7/avatar/u1.400.webp',
			Body: bytes,
			ContentType: 'image/webp',
			CacheControl: 'public, max-age=31536000, immutable'
		});
	});

	it('deletePrefix lists then deletes the listed keys', async () => {
		const { client, sent } = fakeClient((cmd) =>
			cmd instanceof ListObjectsV2Command
				? { Contents: [{ Key: '7/avatar/u1.400.webp' }, { Key: '7/avatar/u1.800.webp' }] }
				: {}
		);
		await r2MediaStore(client).deletePrefix('7/avatar/u1.');
		expect(sent).toHaveLength(2);
		expect((sent[0] as ListObjectsV2Command).input.Prefix).toBe('7/avatar/u1.');
		expect(sent[1]).toBeInstanceOf(DeleteObjectsCommand);
		expect((sent[1] as DeleteObjectsCommand).input.Delete?.Objects).toEqual([
			{ Key: '7/avatar/u1.400.webp' },
			{ Key: '7/avatar/u1.800.webp' }
		]);
	});

	it('deletePrefix sends no delete when nothing matches', async () => {
		const { client, sent } = fakeClient(() => ({}));
		await r2MediaStore(client).deletePrefix('7/avatar/none');
		expect(sent).toHaveLength(1);
		expect(sent[0]).toBeInstanceOf(ListObjectsV2Command);
	});

	it('deletePrefix follows pagination', async () => {
		let page = 0;
		const { client, sent } = fakeClient((cmd) => {
			if (!(cmd instanceof ListObjectsV2Command)) return {};
			return page++ === 0
				? { Contents: [{ Key: 'a' }], IsTruncated: true, NextContinuationToken: 't' }
				: { Contents: [{ Key: 'b' }] };
		});
		await r2MediaStore(client).deletePrefix('p');
		expect((sent[2] as ListObjectsV2Command).input.ContinuationToken).toBe('t');
		const deletes = sent.filter((c) => c instanceof DeleteObjectsCommand);
		expect(deletes).toHaveLength(2);
	});

	it('get returns the body stream, content type and length', async () => {
		delete process.env.R2_MEDIA_BUCKET;
		const stream = new Response(new Uint8Array([9, 8, 7])).body!;
		const { client, sent } = fakeClient(() => ({
			Body: { transformToWebStream: () => stream },
			ContentType: 'image/webp',
			ContentLength: 3
		}));
		const obj = await r2MediaStore(client).get('7/avatar/u1.400.webp');
		expect(sent[0]).toBeInstanceOf(GetObjectCommand);
		expect((sent[0] as GetObjectCommand).input).toEqual({ Bucket: 'iksi-media', Key: '7/avatar/u1.400.webp' });
		expect(obj).toEqual({ body: stream, contentType: 'image/webp', contentLength: 3 });
	});

	it.each([
		['NoSuchKey', Object.assign(new Error('missing'), { name: 'NoSuchKey' })],
		['HTTP 404', Object.assign(new Error('NotFound'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } })]
	])('get returns null on %s', async (_label, err) => {
		const { client } = fakeClient(() => {
			throw err;
		});
		expect(await r2MediaStore(client).get('k')).toBeNull();
	});

	it('get rethrows other R2 errors', async () => {
		const { client } = fakeClient(() => {
			throw Object.assign(new Error('denied'), { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } });
		});
		await expect(r2MediaStore(client).get('k')).rejects.toThrow('denied');
	});

	it('publicUrl uses default and honours MEDIA_BASE_URL', () => {
		const { client } = fakeClient();
		delete process.env.MEDIA_BASE_URL;
		expect(r2MediaStore(client).publicUrl('7/avatar/u1.400.webp')).toBe(
			'https://cdn.iksi.app/7/avatar/u1.400.webp'
		);
		process.env.MEDIA_BASE_URL = 'https://media.example.com';
		expect(r2MediaStore(client).publicUrl('x.webp')).toBe('https://media.example.com/x.webp');
	});

	it('reads the bucket from env at call time', async () => {
		const { client, sent } = fakeClient();
		const store = r2MediaStore(client);
		process.env.R2_MEDIA_BUCKET = 'other';
		await store.put('k', new Uint8Array(), 'image/webp');
		expect((sent[0] as PutObjectCommand).input.Bucket).toBe('other');
	});

	it('deletePrefix throws when R2 reports per-key failures', async () => {
		const { client } = fakeClient((cmd) =>
			cmd instanceof ListObjectsV2Command
				? { Contents: [{ Key: 'k' }] }
				: { Errors: [{ Key: 'k', Code: 'AccessDenied' }] }
		);
		await expect(r2MediaStore(client).deletePrefix('p.')).rejects.toThrow(/k.*AccessDenied/);
	});

	it('deletePrefix batches deletes at 1000 keys', async () => {
		const all = Array.from({ length: 2500 }, (_, i) => ({ Key: `p.${i}` }));
		let page = 0;
		const { client, sent } = fakeClient((cmd) => {
			if (!(cmd instanceof ListObjectsV2Command)) return {};
			const start = page * 1000;
			page++;
			return {
				Contents: all.slice(start, start + 1000),
				IsTruncated: start + 1000 < all.length,
				NextContinuationToken: 't' + page
			};
		});
		await r2MediaStore(client).deletePrefix('p.');
		const sizes = sent
			.filter((c): c is DeleteObjectsCommand => c instanceof DeleteObjectsCommand)
			.map((c) => c.input.Delete?.Objects?.length);
		expect(sizes).toEqual([1000, 1000, 500]);
	});

	it.each(['', '   '])('deletePrefix rejects empty prefix %j', async (prefix) => {
		const { client, sent } = fakeClient();
		await expect(r2MediaStore(client).deletePrefix(prefix)).rejects.toThrow(/prefix/i);
		expect(sent).toHaveLength(0);
	});

	it('real client uses R2-safe checksum settings', async () => {
		const c = createR2Client();
		expect(await c.config.requestChecksumCalculation()).toBe('WHEN_REQUIRED');
		expect(await c.config.responseChecksumValidation()).toBe('WHEN_REQUIRED');
	});
});
