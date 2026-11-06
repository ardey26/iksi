import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/svelte';
import Page from './+page.svelte';
import { marketingPage } from '#lib/marketing/pages.js';

const fetchMock = vi.fn();
const reply = (body, status = 200) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
});
afterEach(cleanup);

const submit = async (value) => {
  await fireEvent.input(screen.getByLabelText('Link'), { target: { value } });
  await fireEvent.click(screen.getByRole('button', { name: 'Check link' }));
};

describe('/tools/link-checker', () => {
  it('posts the link and shows the verdict as a badge', async () => {
    reply({ verdict: 'safe' });
    const { container } = render(Page);
    await submit('example.com/login');
    await waitFor(() => expect(container.querySelector('[data-result] .badge')?.textContent).toMatch(/^\s*Safe\s*$/));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/tools/check');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ url: 'example.com/login' });
    expect(container.querySelector('[data-result]').textContent).toMatch(/not a guarantee/i);
    expect(container.querySelector('[data-result]').textContent).toContain('example.com');
  });

  it.each([
    ['phishing', 'Phishing', 'error'],
    ['malware', 'Malware', 'error'],
    ['unwanted', 'Unwanted', 'warning'],
    ['unavailable', 'Couldn’t check right now', 'neutral']
  ])('labels %s as %s', async (verdict, label, variant) => {
    reply({ verdict });
    const { container } = render(Page);
    await submit('example.com');
    await waitFor(() => expect(container.querySelector('[data-result] .badge')?.textContent.trim()).toBe(label));
    expect(container.querySelector('[data-result] .badge').classList.contains(variant)).toBe(true);
  });

  it('shows the limit message as a field error', async () => {
    reply({ error: 'Too many checks. Try again in an hour.' }, 429);
    const { container } = render(Page);
    await submit('example.com');
    await waitFor(() => expect(container.querySelector('[id$="-error"]').textContent).toBe('Too many checks. Try again in an hour.'));
    expect(container.querySelector('[data-result] .badge')).toBeNull();
  });

  it('refuses an invalid link without a request', async () => {
    const { container } = render(Page);
    await submit('not a link');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('[id$="-error"]').textContent).toMatch(/valid link/i);
  });

  it('reserves the result area before there is a result', () => {
    const { container } = render(Page);
    const area = container.querySelector('[data-result]');
    expect(area).not.toBeNull();
    expect(area.getAttribute('aria-live')).toBe('polite');
  });

  it('links to the shortener and the expander', () => {
    render(Page);
    expect(screen.getByRole('link', { name: /shorten a link/i }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: /url expander/i }).getAttribute('href')).toBe('/tools/url-expander');
  });

  it('styles every inline link as a text link', () => {
    const { container } = render(Page);
    const links = [...container.querySelectorAll('p a')];
    expect(links.length).toBeGreaterThan(0);
    for (const a of links) expect(a.classList.contains('text-link'), a.textContent).toBe(true);
  });

  it('is registered with an FAQ', () => {
    const p = marketingPage('/tools/link-checker');
    expect(p.kind).toBe('tool');
    expect(JSON.stringify(p.structuredData())).toContain('FAQPage');
    render(Page);
    expect(screen.getByText('Does "Safe" mean the link is safe?')).toBeTruthy();
  });
});
