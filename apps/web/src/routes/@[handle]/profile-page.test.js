import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
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
    expect(img.getAttribute('width')).toBe('56');
    expect(img.getAttribute('height')).toBe('56');
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
