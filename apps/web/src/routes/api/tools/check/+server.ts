import type { RequestHandler } from './$types';
import { readToolURL, toolAllowed, toolJSON, toolSafeBrowsing, TOOL_URL_LENGTH } from '#lib/server/tool-limits.js';

// The link checker: a Safe Browsing lookup for one pasted link. The page is
// never fetched. Nothing is stored, and no link or click table is touched.

/** An http(s) URL for a pasted link (a bare host gets https://), or null. */
function checkable(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length > TOOL_URL_LENGTH) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.hostname ? url.href : null;
  } catch {
    return null;
  }
}

export const POST: RequestHandler = async (event) => {
  try {
    const input = await readToolURL(event.request);
    if (input === null) return toolJSON({ error: 'Send a link as { "url": "..." }' }, 400);
    const url = checkable(input);
    if (!url) return toolJSON({ error: 'Enter a valid link, like example.com.' }, 400);

    const allowed = await toolAllowed(event, 'check');
    if (!allowed.ok) return toolJSON({ error: allowed.error }, allowed.status);

    return toolJSON({ verdict: await toolSafeBrowsing(url) });
  } catch (err) {
    console.error('Link checker error:', err);
    return toolJSON({ error: 'Something went wrong. Try again.' }, 500);
  }
};
