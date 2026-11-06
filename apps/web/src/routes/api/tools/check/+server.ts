import type { RequestHandler } from './$types';
import { readToolURL, toolAllowed, toolJSON, toolSafeBrowsingWithin, toolURL } from '#lib/server/tool-limits.js';

// The link checker: a Safe Browsing lookup for one pasted link. The page is
// never fetched. Nothing is stored, and no link or click table is touched.

/** adapter-vercel: the lookup is capped at 3 s, so this is headroom only. */
export const config = { maxDuration: 20 };

export const POST: RequestHandler = async (event) => {
  try {
    const input = await readToolURL(event.request);
    if (input === null) return toolJSON({ error: 'Send a link as { "url": "..." }' }, 400);
    const url = toolURL(input);
    if (!url) return toolJSON({ error: 'Enter a valid link, like example.com.' }, 400);

    const allowed = await toolAllowed(event, 'check');
    if (!allowed.ok) return toolJSON({ error: allowed.error }, allowed.status);

    return toolJSON({ verdict: await toolSafeBrowsingWithin(url) });
  } catch (err) {
    console.error('Link checker error:', err);
    return toolJSON({ error: 'Something went wrong. Try again.' }, 500);
  }
};
