import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';

const findUnique = vi.hoisted(() => vi.fn());
const create = vi.hoisted(() => vi.fn());
const rateLimit = vi.hoisted(() => vi.fn());
const page = vi.hoisted(() => ({ url: new URL('https://www.iksi.app/report') }));

vi.mock('#lib/prisma.js', () => ({
  prisma: {
    longURL: { findUnique, updateMany: vi.fn(async () => ({ count: 0 })) },
    linkReport: { create, findMany: vi.fn(async () => []) },
    profileRow: { updateMany: vi.fn() }
  }
}));
vi.mock('#lib/rateLimit.js', () => ({ rateLimit }));
vi.mock('#lib/server/crypto.js', () => ({ decodeURL: vi.fn(async (s: string) => s) }));
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn(), addCacheTag: vi.fn(), dangerouslyDeleteByTag: vi.fn() }));
vi.mock('$app/state', () => ({ page }));
vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

import { actions, load } from './+page.server';
import ReportPage from './+page.svelte';

function post(values: Record<string, string>, ip = '203.0.113.9') {
  const body = new FormData();
  for (const [k, v] of Object.entries({ link: 'iksi.app/abc', reason: 'malware', details: '', email: '', website: '', ...values })) body.set(k, v);
  const request = new Request('https://www.iksi.app/report', { method: 'POST', body });
  return actions.default({ request, getClientAddress: () => ip, url: new URL(request.url) } as never) as Promise<any>;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SECRET_KEY = 's'.repeat(40);
  rateLimit.mockResolvedValue({ allowed: true });
  findUnique.mockImplementation(async ({ where }: any) => (where.shortURL === 'abc' ? { id: 5 } : null));
});
afterEach(cleanup);

describe('/report load', () => {
  it('prefills the link from ?link=', () => {
    expect(load({ url: new URL('https://www.iksi.app/report?link=iksi.app%2Fabc') })).toEqual({ link: 'iksi.app/abc' });
  });
  it('ignores an absurdly long ?link=', () => {
    expect(load({ url: new URL(`https://www.iksi.app/report?link=${'a'.repeat(400)}`) })).toEqual({ link: '' });
  });
  it('is empty without ?link=', () => expect(load({ url: new URL('https://www.iksi.app/report') })).toEqual({ link: '' }));
});

describe('/report action', () => {
  it('answers a stored report and a report for an unknown link exactly alike', async () => {
    const known = await post({});
    const unknown = await post({ link: 'iksi.app/zzz' });
    expect(known).toEqual({ sent: true });
    expect(unknown).toEqual(known);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('answers a honeypot submission alike and stores nothing', async () => {
    expect(await post({ website: 'http://spam' })).toEqual({ sent: true });
    expect(create).not.toHaveBeenCalled();
  });

  it('stores the IP hash, never the IP', async () => {
    await post({}, '198.51.100.7');
    const data = create.mock.calls[0][0].data;
    expect(data.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(data)).not.toContain('198.51.100.7');
  });

  it('fails a bad form with field errors and keeps what was typed', async () => {
    const out = await post({ link: 'google.com/x', reason: '' });
    expect(out.status).toBe(400);
    expect(out.data.errors).toMatchObject({ link: expect.any(String), reason: 'Choose a reason.' });
    expect(out.data.values.link).toBe('google.com/x');
  });

  it('429s a reporter over the hourly limit', async () => {
    rateLimit.mockResolvedValueOnce({ allowed: false });
    const out = await post({});
    expect(out.status).toBe(429);
    expect(out.data.errors.form).toMatch(/Try again later/);
  });

  it('fails a body that is not a form', async () => {
    const request = new Request('https://www.iksi.app/report', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
    const out: any = await actions.default({ request, getClientAddress: () => '1.1.1.1' } as never);
    expect(out.status).toBe(400);
  });
});

describe('/report page', () => {
  it('shows the form with the link prefilled, every reason and optional details and email', () => {
    const { container } = render(ReportPage, { data: { link: 'iksi.app/abc' }, form: null } as never);
    expect(screen.getByRole('heading', { name: 'Report a link' })).toBeTruthy();
    expect((screen.getByLabelText('Short link') as HTMLInputElement).value).toBe('iksi.app/abc');
    const options = [...container.querySelectorAll('select[name=reason] option')].map((o) => o.textContent);
    expect(options).toEqual(['Choose a reason', 'Phishing or scam', 'Malware', 'Spam', 'Illegal content', 'Other']);
    expect(container.querySelector('textarea[name=details]')!.getAttribute('maxlength')).toBe('1000');
    expect(container.querySelector('input[name=email]')!.getAttribute('type')).toBe('email');
    expect(container.textContent).toContain('Optional');
    expect(screen.getByRole('button', { name: 'Send report' })).toBeTruthy();
  });

  it('hides the honeypot from people and from the tab order', () => {
    const { container } = render(ReportPage, { data: { link: '' }, form: null } as never);
    const trap = container.querySelector('input[name=website]')!;
    expect(trap.getAttribute('tabindex')).toBe('-1');
    expect(trap.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('thanks the reporter', () => {
    render(ReportPage, { data: { link: '' }, form: { sent: true } } as never);
    expect(screen.getByRole('heading', { name: "Thanks. We'll review it." })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Send report' })).toBeNull();
  });

  it('shows field errors and keeps what was typed', () => {
    render(ReportPage, {
      data: { link: '' },
      form: { errors: { reason: 'Choose a reason.', form: 'You have sent several reports in the last hour. Try again later.' }, values: { link: 'iksi.app/x', reason: '', details: 'hi', email: '' } }
    } as never);
    expect(screen.getByText('Choose a reason.')).toBeTruthy();
    expect(screen.getByText(/Try again later/)).toBeTruthy();
    expect((screen.getByLabelText('Short link') as HTMLInputElement).value).toBe('iksi.app/x');
  });
});
