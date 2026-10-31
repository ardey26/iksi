// Normalize known "share page" URLs into direct-image URLs, then verify by
// fetching headers. Users routinely paste a Google Drive share link
// (`/file/d/<ID>/view`) which serves HTML, not the image.

const GDRIVE_SHARE_RE = /^https:\/\/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)(?:\/[^?#]*)?/;
// Google user content avatars (e.g. sign-in avatar) use a size suffix like
// `=s96-c`. Providers return 96px by default, which is blurry on retina at 96
// display px. Bump to 400 so we have headroom for 2x rendering.
const GOOGLE_UC_SIZE_RE = /(=s)\d+(-c)?$/i;
// Twitter profile images end with `_normal.jpg` (48px), `_bigger.jpg` (73px),
// `_mini.jpg` (24px). Swap to `_400x400.jpg` for a crisp render.
const TWITTER_SIZE_RE = /_(?:normal|bigger|mini)(\.\w+)$/i;

export function normalizeAvatarUrl(input: string): string {
  const trimmed = input.trim();

  // Google Drive "share page" → direct-image URL
  const gd = trimmed.match(GDRIVE_SHARE_RE);
  if (gd) return `https://drive.google.com/uc?export=view&id=${gd[1]}`;

  // Bump low-res OAuth avatars up to a size that looks crisp on retina.
  // Only rewrite when we recognize the size suffix — appending one blindly
  // can break URLs that use a different convention.
  if (/googleusercontent\.com\//i.test(trimmed) && GOOGLE_UC_SIZE_RE.test(trimmed)) {
    return trimmed.replace(GOOGLE_UC_SIZE_RE, '$1400$2');
  }
  if (/pbs\.twimg\.com\/profile_images\//i.test(trimmed) && TWITTER_SIZE_RE.test(trimmed)) {
    return trimmed.replace(TWITTER_SIZE_RE, '_400x400$1');
  }

  return trimmed;
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
