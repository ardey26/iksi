import { error, fail, type Cookies } from '@sveltejs/kit';
import { verifySession } from '#lib/server/auth.js';
import { disableLink, dismissReports, openReportGroups } from '#lib/server/reports.js';

/**
 * The layout redirects a signed-out visitor, but a page load runs alongside
 * it and form actions skip it entirely, so each checks the session itself.
 */
const isAdmin = (cookies: Cookies) => verifySession(cookies.get('admin_session'));

export const load = async ({ cookies }: { cookies: Cookies }) => {
  if (!isAdmin(cookies)) error(401, 'Sign in again.');
  return { groups: await openReportGroups(), now: Date.now() };
};

async function linkIdOf(request: Request): Promise<number | null> {
  try {
    const n = Number((await request.formData()).get('linkId'));
    return Number.isInteger(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

type Event = { request: Request; cookies: Cookies };

function act(run: (linkId: number) => Promise<boolean>, done: 'disabled' | 'dismissed') {
  return async ({ request, cookies }: Event) => {
    if (!isAdmin(cookies)) return fail(401, { error: 'Sign in again.' });
    const linkId = await linkIdOf(request);
    if (linkId === null) return fail(400, { error: 'Choose a link.' });
    if (!(await run(linkId))) return fail(404, { error: 'That link no longer exists.', linkId });
    return { done, linkId };
  };
}

export const actions = {
  disable: act((id) => disableLink(id), 'disabled'),
  dismiss: act((id) => dismissReports(id), 'dismissed')
};
