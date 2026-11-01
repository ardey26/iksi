import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Page from './+page.svelte';

const base = {
  handle: 'ann',
  displayName: 'Ann',
  bio: null,
  avatarUrl: 'https://cdn.iksi.app/7/avatar/a.256.webp',
  theme: '20',
  accent: '#3b82f6',
  publicClicks: false,
  rows: [],
  sameAs: []
};
const BG = 'https://cdn.iksi.app/7/background/u1.1600.webp';

function rootStyle(data) {
  const { container } = render(Page, { data });
  return container.querySelector('.iksi-profile').getAttribute('style');
}

describe('public profile background', () => {
  it('uses the uploaded background on the root', () => {
    expect(rootStyle({ ...base, backgroundUrl: BG })).toContain(`url("${BG}")`);
  });

  it('adds a solid color-mix scrim and no gradient', () => {
    const { container } = render(Page, { data: { ...base, backgroundUrl: BG } });
    const scrim = container.querySelector('.profile-scrim');
    expect(scrim.getAttribute('style')).toContain('color-mix(in srgb, var(--bg) 72%, transparent)');
    expect(container.innerHTML).not.toContain('gradient');
  });

  it('renders no url() or scrim without a background', () => {
    const { container } = render(Page, { data: { ...base, backgroundUrl: null } });
    expect(container.querySelector('.iksi-profile').getAttribute('style')).not.toContain('url(');
    expect(container.querySelector('.profile-scrim')).toBeNull();
  });

  it.each([
    'http://cdn.iksi.app/a.webp',
    'javascript:alert(1)',
    'https://x.test/a")};background:url(//evil',
    "https://x.test/a'b.webp",
    'https://x.test/a\\b.webp',
    'https://x.test/a)b.webp',
    'https://x.test/a\nb.webp',
    'not a url'
  ])('ignores unsafe value %j', (v) => {
    const style = rootStyle({ ...base, backgroundUrl: v });
    expect(style).not.toContain('url(');
  });

  it('keeps avatar dimensions', () => {
    const { container } = render(Page, { data: { ...base, backgroundUrl: BG } });
    const img = container.querySelector('img');
    expect(img.getAttribute('width')).toBe('72');
    expect(img.getAttribute('height')).toBe('72');
  });
});

describe('public profile Pay button', () => {
  it('shows the Pay button when the profile has payment methods', () => {
    const pay = { label: 'tip', methods: [{ id: 'l1', kind: 'link', provider: 'kofi', url: 'https://ko-fi.com/ann' }] };
    const { getByRole } = render(Page, { data: { ...base, backgroundUrl: null, pay } });
    expect(getByRole('button', { name: 'Send a tip' })).toBeInTheDocument();
  });

  it('shows no Pay button without payment methods', () => {
    const { queryByRole } = render(Page, { data: { ...base, backgroundUrl: null, pay: null } });
    expect(queryByRole('button', { name: /^(Pay|Send a tip)$/ })).toBeNull();
  });
});

describe('profile canonical and share URL', () => {
  const head = (data) => {
    document.head.innerHTML = '';
    const view = render(Page, { data: { ...base, backgroundUrl: null, ...data } });
    return {
      canonical: document.head.querySelector('link[rel="canonical"]')?.getAttribute('href'),
      ogUrl: document.head.querySelector('meta[property="og:url"]')?.getAttribute('content'),
      ld: JSON.parse(document.head.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}'),
      view
    };
  };

  it('uses www/@handle while subdomains are off', () => {
    const { canonical, ogUrl, ld, view } = head({ subdomains: false });
    expect(canonical).toBe('https://www.iksi.app/@ann');
    expect(ogUrl).toBe('https://www.iksi.app/@ann');
    expect(ld.url).toBe('https://www.iksi.app/@ann');
    expect(view.container.textContent).toContain('iksi.app/@ann');
  });

  it('uses the subdomain when on', () => {
    const { canonical, ogUrl, ld, view } = head({ subdomains: true });
    expect(canonical).toBe('https://ann.iksi.app/');
    expect(ogUrl).toBe('https://ann.iksi.app/');
    expect(ld.url).toBe('https://ann.iksi.app/');
    expect(view.container.textContent).toContain('ann.iksi.app');
  });

  it('copies the same URL the canonical uses', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const { view } = head({ subdomains: true });
    await fireEvent.click(view.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('https://ann.iksi.app/');
  });

  it('keeps www/@handle for a handle that cannot be a hostname', () => {
    expect(head({ handle: 'a_b', subdomains: true }).canonical).toBe('https://www.iksi.app/@a_b');
  });
});

describe('profile canonical after a way back from a subdomain', () => {
  it('has no via param, since the page never sees the query', () => {
    document.head.innerHTML = '';
    render(Page, { data: { ...base, backgroundUrl: null, subdomains: false } });
    const canonical = document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');
    const og = document.head.querySelector('meta[property="og:url"]')?.getAttribute('content');
    expect(canonical).toBe('https://www.iksi.app/@ann');
    expect(og).toBe(canonical);
  });
});
