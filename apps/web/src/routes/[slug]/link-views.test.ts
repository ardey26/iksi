import { describe, it, expect, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';

const page = vi.hoisted(() => ({
  status: 404,
  error: null as unknown,
  url: new URL('https://www.iksi.app/AbC'),
  params: { slug: 'AbC' }
}));
vi.mock('$app/state', () => ({ page }));
vi.mock('$app/forms', () => ({ enhance: () => ({ destroy() {} }) }));

import ErrorPage from './+error.svelte';
import LinkPage from './+page.svelte';

function renderError(status: number, error: Record<string, unknown>) {
  page.status = status;
  page.error = error;
  return render(ErrorPage);
}

describe('+error.svelte', () => {
  it('renders the expired view', () => {
    const { container } = renderError(410, { message: 'x', view: 'expired' });
    expect(screen.getByRole('heading', { name: 'This link has expired' })).toBeTruthy();
    expect(container.querySelector('a[href="/AbC"]')).toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });

  it('renders the flagged view with the verdict and no link to the slug', () => {
    const { container } = renderError(403, { message: 'x', view: 'flagged', verdict: 'phishing' });
    expect(container.textContent).toContain('flagged by Google Safe Browsing as phishing');
    expect(container.querySelector('a[href="/AbC"]')).toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });

  it('renders the already opened view', () => {
    const { container } = renderError(410, { message: 'x', view: 'opened' });
    expect(screen.getByRole('heading', { name: 'This link was already opened' })).toBeTruthy();
    expect(container.querySelector('a[href="/AbC"]')).toBeNull();
    expect(document.title).toBe('Link opened | iksi');
  });

  it('renders the under review view: no redirect, no link to the slug, a way to report', () => {
    page.url = new URL('https://www.iksi.app/AbC');
    const { container } = renderError(403, { message: 'This link is under review.', view: 'flagged', verdict: 'review' });
    expect(screen.getByRole('heading', { name: 'Link under review' })).toBeTruthy();
    expect(container.textContent).toContain('This link was reported and is under review');
    expect(container.textContent).not.toContain('Safe Browsing');
    expect(container.querySelector('a[href="/AbC"]')).toBeNull();
    expect(container.querySelector('a[href="/report?link=iksi.app%2FAbC"]')?.textContent).toBe('Report this link');
    expect(document.title).toBe('Link under review | iksi');
  });

  it('renders a link an admin disabled without naming Safe Browsing', () => {
    const { container } = renderError(403, { message: 'x', view: 'flagged', verdict: 'disabled' });
    expect(screen.getByRole('heading', { name: 'Link disabled' })).toBeTruthy();
    expect(container.textContent).toContain('This link was disabled after a review.');
    expect(container.textContent).not.toContain('Safe Browsing');
  });

  it('keeps the 404 copy', () => {
    renderError(404, { message: 'not found' });
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });
});

describe('+page.svelte preview', () => {
  const base = { view: 'preview', host: 'example.com', destination: 'https://example.com/a', hasRules: false, flagged: null, expired: false };

  it('offers a reloading Continue link and the rules copy', () => {
    page.url = new URL('https://www.iksi.app/AbC+');
    const { container } = render(LinkPage, { data: { ...base, hasRules: true }, form: null } as never);
    const a = container.querySelector('a[href="/AbC"]')!;
    expect(a.getAttribute('data-sveltekit-reload')).not.toBeNull();
    expect(container.textContent).toContain('This link may send some visitors elsewhere');
  });

  it('flagged preview names the verdict, shows the host as plain text and has no Continue', () => {
    const { container } = render(LinkPage, { data: { ...base, destination: null, flagged: 'malware' }, form: null } as never);
    expect(container.textContent).toContain('malware');
    expect(container.textContent).toContain('example.com');
    // Only home, the report form and the privacy policy: nothing that leads to the destination.
    expect(container.querySelector('a:not([href="/"]):not([href^="/report?"]):not([href="/privacy"])')).toBeNull();
  });

  it('a preview of a link under review says so and has no Continue', () => {
    page.url = new URL('https://www.iksi.app/AbC+');
    const { container } = render(LinkPage, { data: { ...base, destination: null, flagged: 'review' }, form: null } as never);
    expect(screen.getByRole('heading', { name: 'Link under review' })).toBeTruthy();
    expect(container.querySelector('a[href="/AbC"]')).toBeNull();
    expect(document.title).toBe('Link under review | iksi');
  });

  it('every preview links to the report form with the link filled in', () => {
    page.url = new URL('https://www.iksi.app/AbC+');
    const { container } = render(LinkPage, { data: base, form: null } as never);
    expect(container.querySelector('a[href="/report?link=iksi.app%2FAbC"]')?.textContent).toBe('Report this link');
  });

  it('link pages and notices link to the privacy policy, on www from a subdomain', () => {
    page.url = new URL('https://www.iksi.app/AbC+');
    const { container } = render(LinkPage, { data: base, form: null } as never);
    expect(container.querySelector('a[href="/privacy"]')?.textContent).toBe('Privacy');
    cleanup();
    page.url = new URL('https://andre.iksi.app/sale+');
    const sub = render(LinkPage, { data: base, form: null } as never);
    expect(sub.container.querySelector('a[href="https://www.iksi.app/privacy"]')?.textContent).toBe('Privacy');
    cleanup();
    page.url = new URL('https://www.iksi.app/AbC');
    const notice = renderError(410, { message: 'x', view: 'expired' });
    expect(notice.container.querySelector('a[href="/privacy"]')?.textContent).toBe('Privacy');
  });

  it('the password page links to the report form too', () => {
    page.url = new URL('https://www.iksi.app/AbC');
    const { container } = render(LinkPage, { data: { view: 'password', error: null }, form: null } as never);
    expect(container.querySelector('a[href="/report?link=iksi.app%2FAbC"]')).not.toBeNull();
  });

  it('expired preview says so and has no Continue', () => {
    const { container } = render(LinkPage, { data: { ...base, destination: null, expired: true }, form: null } as never);
    expect(container.textContent).toContain('This link has expired');
    expect(container.querySelector('a[href="/AbC"]')).toBeNull();
  });

  it('password input allows 128 characters', () => {
    const { container } = render(LinkPage, { data: { view: 'password', error: null }, form: null } as never);
    expect(container.querySelector('input[type=password]')!.getAttribute('maxlength')).toBe('128');
  });
});

describe('+page.svelte one-time', () => {
  const reveal = { view: 'reveal', kind: 'text', password: false, error: null };

  it('shows a tap to reveal form that posts to the reveal action', () => {
    const { container } = render(LinkPage, { data: reveal, form: null } as never);
    expect(screen.getByRole('heading', { name: 'Someone sent you a one-time link' })).toBeTruthy();
    const form = container.querySelector('form')!;
    expect(form.getAttribute('method')).toBe('POST');
    expect(form.getAttribute('action')).toBe('?/reveal');
    expect(screen.getByRole('button', { name: 'Reveal message' })).toBeTruthy();
    expect(container.querySelector('input[type=password]')).toBeNull();
    expect(container.textContent).toContain('can be opened once');
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });

  it('a URL secret says what the button does', () => {
    render(LinkPage, { data: { ...reveal, kind: 'url' }, form: null } as never);
    expect(screen.getByRole('button', { name: 'Open link' })).toBeTruthy();
  });

  it('asks for the password when the link has one', () => {
    const { container } = render(LinkPage, { data: { ...reveal, password: true }, form: null } as never);
    const input = container.querySelector('input[type=password]')!;
    expect(input.getAttribute('name')).toBe('password');
    expect(input.getAttribute('maxlength')).toBe('128');
  });

  it('shows a wrong password error', () => {
    render(LinkPage, { data: { ...reveal, password: true }, form: { error: 'Wrong password' } } as never);
    expect(screen.getByText('Wrong password')).toBeTruthy();
  });

  it('shows the revealed text once, as text, with a copy button and no form', () => {
    const text = '<b>not html</b>\nsecond line';
    const { container } = render(LinkPage, { data: { view: 'opened' }, form: { text } } as never);
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<b>not html</b>');
    expect(screen.getByRole('button', { name: 'Copy text' })).toBeTruthy();
    expect(container.querySelector('form')).toBeNull();
    expect(container.textContent).toContain('no longer stored');
  });

  it('a lost reveal says it was already opened', () => {
    const { container } = render(LinkPage, { data: reveal, form: { opened: true } } as never);
    expect(container.textContent).toContain('This link was already opened');
    expect(container.querySelector('form')).toBeNull();
  });

  it('the preview of a one-time link hides the content and says what it is', () => {
    page.url = new URL('https://www.iksi.app/AbC+');
    const { container } = render(LinkPage, {
      data: { view: 'preview', host: '', destination: null, hasRules: false, flagged: null, expired: false, oneTime: true, opened: false },
      form: null
    } as never);
    expect(screen.getByRole('heading', { name: 'One-time link' })).toBeTruthy();
    expect(container.querySelector('a[href="/AbC"]')).not.toBeNull();
  });

  it('the preview of an opened one-time link says so and has no Continue', () => {
    page.url = new URL('https://www.iksi.app/AbC+');
    const { container } = render(LinkPage, {
      data: { view: 'preview', host: '', destination: null, hasRules: false, flagged: null, expired: false, oneTime: true, opened: true },
      form: null
    } as never);
    expect(container.textContent).toContain('This link was already opened');
    expect(container.querySelector('a[href="/AbC"]')).toBeNull();
  });
});
