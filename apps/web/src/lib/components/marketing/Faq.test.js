import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import Faq from './Faq.svelte';
import PlainList from './PlainList.svelte';
import TextLink from './TextLink.svelte';
import textLinkSource from './TextLink.svelte?raw';

afterEach(cleanup);

const items = [
  { q: 'First?', a: 'One.' },
  { q: 'Second?', a: 'Two.' }
];

describe('Faq', () => {
  it('renders a Questions section with each question and answer in order', () => {
    const { container } = render(Faq, { props: { items } });
    expect(screen.getByRole('heading', { name: 'Questions' })).toBeTruthy();
    expect([...container.querySelectorAll('dl.faq dt')].map((n) => n.textContent)).toEqual(['First?', 'Second?']);
    expect([...container.querySelectorAll('dl.faq dd')].map((n) => n.textContent)).toEqual(['One.', 'Two.']);
  });
});

describe('PlainList', () => {
  it('renders a ul by default and an ol when ordered', () => {
    expect(render(PlainList).container.querySelector('ul.plain')).not.toBeNull();
    cleanup();
    expect(render(PlainList, { props: { ordered: true } }).container.querySelector('ol.plain')).not.toBeNull();
  });
});

describe('TextLink', () => {
  it('renders an accent, underlined link, as on the privacy page', () => {
    const { container } = render(TextLink, { props: { href: '/x' } });
    const a = container.querySelector('a');
    expect(a.getAttribute('href')).toBe('/x');
    expect(a.classList.contains('text-link')).toBe(true);
    expect(textLinkSource).toMatch(/color: var\(--accent\)/);
    expect(textLinkSource).toMatch(/text-decoration: underline/);
    expect(textLinkSource).toMatch(/:focus-visible/);
  });
});
