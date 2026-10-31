export type SafeVerdict = 'safe' | 'malware' | 'phishing' | 'unwanted' | 'pending';

export async function checkURL(url: string): Promise<SafeVerdict> {
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
            threatEntries: [{ url }]
          }
        })
      }
    );
    if (!res.ok) return 'pending';
    const body = await res.json();
    if (!body.matches?.length) return 'safe';
    const t: string = body.matches[0].threatType;
    if (t === 'MALWARE') return 'malware';
    if (t === 'SOCIAL_ENGINEERING') return 'phishing';
    if (t === 'UNWANTED_SOFTWARE' || t === 'POTENTIALLY_HARMFUL_APPLICATION') return 'unwanted';
    return 'safe';
  } catch {
    return 'pending';
  }
}
