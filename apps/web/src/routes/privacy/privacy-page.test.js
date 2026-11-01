// The privacy policy (/privacy): one readable column on the kit, a Display
// title with the last-updated date, contents that link to every section, the
// contact address, and its own indexable SEO from the layout.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';

vi.hoisted(() => {
  const store = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) }
  });
});

const page = vi.hoisted(() => ({ url: new URL('https://www.iksi.app/privacy'), route: { id: '/privacy' } }));
vi.mock('$app/state', () => ({ page, navigating: { to: null } }));

import Privacy from './+page.svelte';
import Layout from '../+layout.svelte';

afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
});

describe('privacy page', () => {
  it('has a Display title and the last-updated date', () => {
    render(Privacy);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Privacy');
    expect(h1).toHaveClass('t-display');
    expect(document.body.textContent).toContain('Last updated November 1, 2026');
  });

  it('gives the contact address as a mail link', () => {
    const { container } = render(Privacy);
    expect(container.textContent).toContain('andre@iksi.app');
    const mail = [...container.querySelectorAll('a[href^="mailto:"]')];
    expect(mail.length).toBeGreaterThan(0);
    for (const a of mail) expect(a).toHaveAttribute('href', 'mailto:andre@iksi.app');
  });

  it('links every contents entry to a section with that id, in order', () => {
    const { container } = render(Privacy);
    const toc = screen.getByRole('navigation', { name: 'Contents' });
    const targets = [...toc.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    const sections = [...container.querySelectorAll('section.ui-section')].map((s) => `#${s.id}`);
    expect(targets.length).toBeGreaterThan(10);
    expect(targets).toEqual(sections);
    for (const href of targets) {
      const section = container.querySelector(href);
      const name = toc.querySelector(`a[href="${href}"]`).textContent;
      expect(section.querySelector('h2')).toHaveTextContent(name);
    }
  });

  it('keeps in-page links pointing at real sections', () => {
    const { container } = render(Privacy);
    for (const a of container.querySelectorAll('.sections a[href^="#"]')) {
      expect(container.querySelector(a.getAttribute('href'))).not.toBeNull();
    }
  });

  it('covers the data the code handles', () => {
    const { container } = render(Privacy);
    const text = container.textContent;
    for (const fact of [
      'AES-256-GCM',
      'bcrypt',
      'user_session',
      'login_next',
      'Google Safe Browsing',
      'AdSense',
      'Cloudflare',
      'Supabase',
      'Vercel',
      'HMAC-SHA256',
      'Republic Act No. 10173',
      'under 13'
    ]) {
      expect(text).toContain(fact);
    }
  });

  it('gets an indexable title, description and canonical from the layout', () => {
    const children = createRawSnippet(() => ({ render: () => '<p>content</p>' }));
    render(Layout, { props: { data: { user: null }, children } });
    expect(document.title).toBe('Privacy | iksi');
    expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute('href', 'https://www.iksi.app/privacy');
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
    expect(document.head.querySelector('meta[name="description"]').getAttribute('content')).toMatch(/iksi collects/);
  });
});
