import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';

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
    expect(screen.getByText('This link has expired.')).toBeTruthy();
    expect(container.querySelector('a[href="/AbC"]')).toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });

  it('renders the flagged view with the verdict and no link to the slug', () => {
    const { container } = renderError(403, { message: 'x', view: 'flagged', verdict: 'phishing' });
    expect(container.textContent).toContain('flagged by Google Safe Browsing as phishing');
    expect(container.querySelector('a[href="/AbC"]')).toBeNull();
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
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
    expect(container.querySelector('a:not([href="/"])')).toBeNull();
  });

  it('expired preview says so and has no Continue', () => {
    const { container } = render(LinkPage, { data: { ...base, destination: null, expired: true }, form: null } as never);
    expect(container.textContent).toContain('This link has expired.');
    expect(container.querySelector('a[href="/AbC"]')).toBeNull();
  });

  it('password input allows 128 characters', () => {
    const { container } = render(LinkPage, { data: { view: 'password', error: null }, form: null } as never);
    expect(container.querySelector('input[type=password]')!.getAttribute('maxlength')).toBe('128');
  });
});
