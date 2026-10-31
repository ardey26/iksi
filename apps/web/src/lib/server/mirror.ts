// One-off migration: copy hot-linked avatars into R2 through the same
// pipeline as uploads. One failing profile never stops the run.
import { MAX_UPLOAD_BYTES, MediaError, processImage } from './media';
import type { MediaStore } from './media-store';
import { replaceMedia, type ProfileMediaDb } from './profile-media';
import { normalizeAvatarUrl } from './avatar-url';

export interface MirrorReport {
	mirrored: number;
	skipped: number;
	failed: { profileId: number; reason: string }[];
}

export interface MirrorDeps {
	fetchImage: (url: string) => Promise<Uint8Array>;
	db: ProfileMediaDb;
	store: MediaStore;
	newId: () => string;
	dryRun: boolean;
}

const FETCH_TIMEOUT_MS = 10_000;

export async function fetchImage(
	url: string,
	fetchImpl: typeof fetch = fetch
): Promise<Uint8Array> {
	const res = await fetchImpl(url, {
		redirect: 'follow',
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const declared = Number(res.headers.get('content-length'));
	if (declared > MAX_UPLOAD_BYTES) {
		await res.body?.cancel();
		throw new MediaError('too_large');
	}
	if (!res.body) return new Uint8Array(await res.arrayBuffer());

	const chunks: Uint8Array[] = [];
	let total = 0;
	const reader = res.body.getReader();
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > MAX_UPLOAD_BYTES) {
			await reader.cancel();
			throw new MediaError('too_large');
		}
		chunks.push(value);
	}
	const out = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) {
		out.set(c, offset);
		offset += c.byteLength;
	}
	return out;
}

export async function mirrorAvatars(
	profiles: { profileId: number; userId: number; avatarUrl: string }[],
	deps: MirrorDeps
): Promise<MirrorReport> {
	const report: MirrorReport = { mirrored: 0, skipped: 0, failed: [] };
	const cdn = process.env.MEDIA_BASE_URL || 'https://cdn.iksi.app';

	for (const p of profiles) {
		if (p.avatarUrl.startsWith(cdn)) {
			report.skipped++;
			continue;
		}
		try {
			const bytes = await deps.fetchImage(normalizeAvatarUrl(p.avatarUrl));
			if (deps.dryRun) await processImage(bytes, 'avatar');
			else await replaceMedia(p.userId, 'avatar', bytes, deps);
			report.mirrored++;
		} catch (err) {
			const reason =
				err instanceof MediaError ? err.code : err instanceof Error ? err.message : String(err);
			report.failed.push({ profileId: p.profileId, reason });
		}
	}
	return report;
}
