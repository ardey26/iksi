export type SafeVerdict = 'safe' | 'malware' | 'phishing' | 'unwanted' | 'pending';

const THREATS: Record<string, SafeVerdict> = {
  MALWARE: 'malware',
  SOCIAL_ENGINEERING: 'phishing',
  UNWANTED_SOFTWARE: 'unwanted',
  POTENTIALLY_HARMFUL_APPLICATION: 'unwanted'
};

/** Worst first: one match of a higher rank decides the whole lookup. */
const RANK: SafeVerdict[] = ['malware', 'phishing', 'unwanted'];

export async function checkURL(url: string): Promise<SafeVerdict> {
  return checkURLs([url]);
}

/**
 * One Safe Browsing lookup for every URL a link can send a visitor to. The
 * worst match wins; 'pending' when the lookup could not be made. A link has at
 * most 1 + 20 rules x 5 split entries = 101 URLs, under the API's 500 per call.
 */
export async function checkURLs(urls: readonly string[]): Promise<SafeVerdict> {
  const unique = [...new Set(urls)];
  if (unique.length === 0) return 'safe';
  const key = process.env.SAFE_BROWSING_API_KEY;
  if (!key) return 'pending';
  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${encodeURIComponent(key)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'iksi', clientVersion: '1.0' },
          threatInfo: {
            threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: unique.map((url) => ({ url }))
          }
        })
      }
    );
    if (!res.ok) return 'pending';
    const body = await res.json();
    const found = new Set<SafeVerdict>();
    for (const m of body.matches ?? []) {
      const v = THREATS[m?.threatType];
      if (v) found.add(v);
    }
    return RANK.find((v) => found.has(v)) ?? 'safe';
  } catch {
    return 'pending';
  }
}
