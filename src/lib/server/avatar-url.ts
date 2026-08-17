// Normalize known "share page" URLs into direct-image URLs, then verify by
// fetching headers. Users routinely paste a Google Drive share link
// (`/file/d/<ID>/view`) which serves HTML, not the image.

const GDRIVE_SHARE_RE = /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)(?:\/[^?#]*)?/;

export function normalizeAvatarUrl(input: string): string {
  const m = input.trim().match(GDRIVE_SHARE_RE);
  if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
  return input.trim();
}

export type AvatarCheck = { ok: true; url: string } | { ok: false; error: string };

// Verify the URL points to an image by fetching headers. Falls back to a
// tiny ranged GET if the host refuses HEAD (some CDNs do).
export async function verifyAvatarUrl(rawUrl: string, fetchImpl: typeof fetch = fetch): Promise<AvatarCheck> {
  const url = normalizeAvatarUrl(rawUrl);

  if (!/^https:\/\//i.test(url)) {
    return { ok: false, error: 'Avatar URL must start with https://' };
  }
  if (url.length > 500) {
    return { ok: false, error: 'Avatar URL is too long' };
  }

  let contentType: string | null = null;
  try {
    const head = await fetchImpl(url, { method: 'HEAD', redirect: 'follow' });
    if (head.ok) contentType = head.headers.get('content-type');
    if (!head.ok || !contentType) {
      const range = await fetchImpl(url, { method: 'GET', redirect: 'follow', headers: { Range: 'bytes=0-0' } });
      if (!range.ok && range.status !== 206) {
        return { ok: false, error: `Could not fetch that URL (HTTP ${range.status})` };
      }
      contentType = range.headers.get('content-type');
    }
  } catch {
    return { ok: false, error: 'Could not reach that URL' };
  }

  if (!contentType || !/^image\//i.test(contentType)) {
    return {
      ok: false,
      error: "That URL doesn't return an image. Paste a direct link to the image file (right-click → Copy image address)."
    };
  }

  return { ok: true, url };
}
