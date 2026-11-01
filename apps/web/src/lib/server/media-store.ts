// Cloudflare R2 adapter for user-uploaded media (avatars, backgrounds).
// Objects are content-addressed by key and never mutated, so they are cached
// as immutable for a year. Env is read at call time so tests and runtime
// config changes take effect without a reload.
import {
	DeleteObjectsCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import { mediaBase } from './media-url';

export interface MediaObject {
	body: ReadableStream<Uint8Array>;
	contentType: string | undefined;
	contentLength?: number;
}

export interface MediaStore {
	put(key: string, body: Uint8Array, contentType: string): Promise<void>;
	// Null when no object has this key.
	get(key: string): Promise<MediaObject | null>;
	// Deletes every object whose key starts with prefix.
	deletePrefix(prefix: string): Promise<void>;
	publicUrl(key: string): string;
}

const CACHE_CONTROL = 'public, max-age=31536000, immutable';
// DeleteObjects accepts at most 1000 keys per request, matching list page size.
const DELETE_BATCH = 1000;

function isNotFound(err: unknown): boolean {
	const e = err as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
	return e?.name === 'NoSuchKey' || e?.$metadata?.httpStatusCode === 404;
}

export function createR2Client(): S3Client {
	return new S3Client({
		region: 'auto',
		// R2 rejects the CRC checksum headers newer SDK versions send by default.
		requestChecksumCalculation: 'WHEN_REQUIRED',
		responseChecksumValidation: 'WHEN_REQUIRED',
		endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
			secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? ''
		}
	});
}

export function r2MediaStore(client?: S3Client): MediaStore {
	let cached = client;
	const getClient = () => (cached ??= createR2Client());
	const bucket = () => process.env.R2_MEDIA_BUCKET || 'iksi-media';

	return {
		async put(key, body, contentType) {
			await getClient().send(
				new PutObjectCommand({
					Bucket: bucket(),
					Key: key,
					Body: body,
					ContentType: contentType,
					CacheControl: CACHE_CONTROL
				})
			);
		},

		async get(key) {
			try {
				const res = await getClient().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
				if (!res.Body) return null;
				return {
					body: res.Body.transformToWebStream() as ReadableStream<Uint8Array>,
					contentType: res.ContentType,
					contentLength: res.ContentLength
				};
			} catch (err) {
				if (isNotFound(err)) return null;
				throw err;
			}
		},

		async deletePrefix(prefix) {
			// An empty prefix would list, and delete, the whole bucket.
			if (!prefix.trim()) throw new Error('deletePrefix requires a non-empty prefix');
			const failures: string[] = [];
			let token: string | undefined;
			do {
				const page = await getClient().send(
					new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token })
				);
				const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
				for (let i = 0; i < keys.length; i += DELETE_BATCH) {
					// R2/S3 answer 200 even when individual keys fail; failures are in Errors.
					const res = await getClient().send(
						new DeleteObjectsCommand({
							Bucket: bucket(),
							Delete: { Objects: keys.slice(i, i + DELETE_BATCH), Quiet: true }
						})
					);
					for (const e of res?.Errors ?? []) failures.push(`${e.Key} (${e.Code})`);
				}
				token = page.IsTruncated ? page.NextContinuationToken : undefined;
			} while (token);
			if (failures.length) {
				throw new Error(`Failed to delete ${failures.length} object(s): ${failures.join(', ')}`);
			}
		},

		publicUrl(key) {
			return `${mediaBase()}/${key}`;
		}
	};
}
