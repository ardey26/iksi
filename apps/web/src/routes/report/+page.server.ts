import { fail, type RequestEvent } from '@sveltejs/kit';
import { LINK_INPUT_MAX } from '#lib/report.js';
import { clientOf } from '#lib/server/client.js';
import { submitReport } from '#lib/server/reports.js';

/** `?link=` prefills the short link when the visitor comes from a link page. */
export const load = ({ url }: { url: URL }) => {
  const link = url.searchParams.get('link') ?? '';
  return { link: link.length <= LINK_INPUT_MAX ? link : '' };
};

export const actions = {
  default: async (event: RequestEvent) => {
    let form: FormData;
    try {
      form = await event.request.formData();
    } catch {
      return fail(400, { errors: { form: 'Something went wrong. Try again.' }, values: null });
    }
    const out = await submitReport(form, clientOf(event).ip, { dev: import.meta.env.DEV });
    // Stored, dropped or about a link that does not exist: always the same answer.
    if (out.ok) return { sent: true };
    return fail(out.status, { errors: out.errors, values: out.values });
  }
};
