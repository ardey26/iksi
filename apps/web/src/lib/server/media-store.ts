// Cloudflare R2 adapter for user-uploaded media (avatars, backgrounds).
// Objects are content-addressed by key and never mutated, so they are cached
// as immutable for a year. Env is read at call time so tests and runtime
// config changes take effect without a reload.
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export interface MediaStore {
	put(key: string, body: Uint8Array, contentType: string): Promise<void>;
	// Deletes every object whose key starts with prefix.
	deletePrefix(prefix: string): Promise<void>;
	publicUrl(key: string): string;
}

const CACHE_CONTROL = 'public, max-age=31536000, immutable';
// DeleteObjects accepts at most 1000 keys per request, matching list page size.
const DELETE_BATCH = 1000;

function defaultClient(): S3Client {
	return new S3Client({
		region: 'auto',
		endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
			secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? ''
		}
	});
}

export function r2MediaStore(client?: S3Client): MediaStore {
	let cached = client;
	const getClient = () => (cached ??= defaultClient());
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

		async deletePrefix(prefix) {
			let token: string | undefined;
			do {
				const page = await getClient().send(
					new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, ContinuationToken: token })
				);
				const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
				for (let i = 0; i < keys.length; i += DELETE_BATCH) {
					await getClient().send(
						new DeleteObjectsCommand({
							Bucket: bucket(),
							Delete: { Objects: keys.slice(i, i + DELETE_BATCH), Quiet: true }
						})
					);
				}
				token = page.IsTruncated ? page.NextContinuationToken : undefined;
			} while (token);
		},

		publicUrl(key) {
			const base = (process.env.MEDIA_BASE_URL || 'https://cdn.iksi.app').replace(/\/+$/, '');
			return `${base}/${key}`;
		}
	};
}
