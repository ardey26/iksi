import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';

const verifySession = vi.hoisted(() => vi.fn());
const reports = vi.hoisted(() => ({
  openReportGroups: vi.fn(async () => [] as unknown[]),
  disableLink: vi.fn(async () => true),
  dismissReports: vi.fn(async () => true)
}));
vi.mock('#lib/server/auth.js', () => ({ verifySession }));
vi.mock('#lib/server/reports.js', () => reports);
vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

import { actions, load } from './+page.server';
import ReportsPage from './+page.svelte';

const cookies = (token: string | undefined) => ({ get: (k: string) => (k === 'admin_session' ? token : undefined) }) as never;

function act(name: 'disable' | 'dismiss', linkId: string | null, token = 'good') {
  const body = new FormData();
  if (linkId !== null) body.set('linkId', linkId);
  const request = new Request('https://admin.iksi.app/admin/reports', { method: 'POST', body });
  return actions[name]({ request, cookies: cookies(token) } as never) as Promise<any>;
}

beforeEach(() => {
  vi.clearAllMocks();
  verifySession.mockImplementation((t: string | undefined) => t === 'good');
});
afterEach(cleanup);

describe('admin reports: auth', () => {
  it('load refuses without an admin session, before reading reports', async () => {
    await expect(load({ cookies: cookies(undefined) })).rejects.toMatchObject({ status: 401 });
    expect(reports.openReportGroups).not.toHaveBeenCalled();
  });

  it.each(['disable', 'dismiss'] as const)('%s refuses without an admin session and changes nothing', async (name) => {
    const out = await act(name, '7', 'forged');
    expect(out.status).toBe(401);
    expect(reports.disableLink).not.toHaveBeenCalled();
    expect(reports.dismissReports).not.toHaveBeenCalled();
  });
});

describe('admin reports: actions', () => {
  it('load lists the open report groups', async () => {
    const out: any = await load({ cookies: cookies('good') });
    expect(out.groups).toEqual([]);
    expect(reports.openReportGroups).toHaveBeenCalled();
  });

  it('Disable link disables that link', async () => {
    expect(await act('disable', '7')).toEqual({ done: 'disabled', linkId: 7 });
    expect(reports.disableLink).toHaveBeenCalledWith(7);
  });

  it('Dismiss dismisses that link\'s reports', async () => {
    expect(await act('dismiss', '7')).toEqual({ done: 'dismissed', linkId: 7 });
    expect(reports.dismissReports).toHaveBeenCalledWith(7);
  });

  it.each([null, 'abc', '0', '-3', '1.5'])('rejects link id %s', async (id) => {
    expect((await act('disable', id)).status).toBe(400);
    expect(reports.disableLink).not.toHaveBeenCalled();
  });

  it('404s a link that is gone', async () => {
    reports.dismissReports.mockResolvedValueOnce(false);
    expect((await act('dismiss', '9')).status).toBe(404);
  });
});

describe('admin reports page', () => {
  const now = Date.parse('2026-11-01T12:00:00Z');
  const group = {
    linkId: 7,
    shortURL: 'bad',
    host: 'evil.example',
    destination: 'https://evil.example/login',
    moderation: 'review',
    safeVerdict: 'safe',
    total: 4,
    reasons: [
      { reason: 'phishing', count: 3 },
      { reason: 'spam', count: 1 }
    ],
    latestAt: new Date(now - 2 * 3600_000),
    latestDetails: 'Asks for my bank login'
  };

  it('shows each reported link with its host, counts by reason, latest details and both actions', () => {
    const { container } = render(ReportsPage, { data: { groups: [group], now }, form: null } as never);
    expect(container.textContent).toContain('iksi.app/bad');
    expect(container.textContent).toContain('evil.example');
    expect(container.textContent).toContain('Under review');
    expect(container.textContent).toContain('Phishing or scam 3');
    expect(container.textContent).toContain('Spam 1');
    expect(container.textContent).toContain('"Asks for my bank login"');
    expect(container.textContent).toContain('4 open reports, last 2 hours ago');
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeTruthy();
    expect(container.textContent).not.toContain('·');
  });

  it('asks before disabling, then posts the link id to the disable action', async () => {
    const { container } = render(ReportsPage, { data: { groups: [group], now }, form: null } as never);
    await fireEvent.click(screen.getByRole('button', { name: 'Disable link' }));
    expect(container.textContent).toContain('Disable it?');
    const form = container.querySelector('form[action="?/disable"]')!;
    expect((form.querySelector('input[name=linkId]') as HTMLInputElement).value).toBe('7');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy();
  });

  it('has an empty state', () => {
    render(ReportsPage, { data: { groups: [], now }, form: null } as never);
    expect(screen.getByText('No open reports')).toBeTruthy();
  });
});
