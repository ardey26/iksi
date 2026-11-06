import type { RequestHandler } from './$types';
import { expandURL } from '#lib/server/expand.js';
import { readToolURL, toolAllowed, toolJSON, toolSafeBrowsing } from '#lib/server/tool-limits.js';

// The URL expander: follows a pasted link's HTTP redirects from the server
// (expandURL holds the SSRF guards) and checks where it ends up. Nothing is
// stored, and no link or click table is touched.

export const POST: RequestHandler = async (event) => {
  try {
    const input = await readToolURL(event.request);
    if (input === null) return toolJSON({ error: 'Send a link as { "url": "..." }' }, 400);

    const allowed = await toolAllowed(event, 'expand');
    if (!allowed.ok) return toolJSON({ error: allowed.error }, allowed.status);

    // Never pass options here: the defaults are the production limits, and
    // the test-only loopback flag must stay off.
    const result = await expandURL(input);
    const verdict = result.final ? await toolSafeBrowsing(result.final) : null;
    return toolJSON({ ...result, verdict });
  } catch (err) {
    console.error('URL expander error:', err);
    return toolJSON({ error: 'Something went wrong. Try again.' }, 500);
  }
};
