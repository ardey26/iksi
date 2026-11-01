import type { Reroute } from '@sveltejs/kit';
import { subdomainReroute } from '#lib/subdomains.js';

// `<handle>.iksi.app` renders the @handle routes. Host-only, so it gives the
// same answer on the server and in client-side navigation; hooks.server.ts
// refuses subdomain requests unless SUBDOMAINS_ENABLED is on.
export const reroute: Reroute = ({ url }) => subdomainReroute(url, import.meta.env.DEV);
