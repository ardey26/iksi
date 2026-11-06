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
  await fireEvent.click(screen.getByRole('button', { name: 'Expand link' }));
};

const DONE = {
  hops: [
    { url: 'https://bit.ly/abc', status: 301 },
    { url: 'https://www.example.com/landing?ref=1', status: 200 }
  ],
  final: 'https://www.example.com/landing?ref=1',
  stopped: null,
  verdict: 'safe'
};

describe('/tools/url-expander', () => {
  it('shows each hop as a row with its host and status, then the final destination', async () => {
    reply(DONE);
    const { container } = render(Page);
    await submit('bit.ly/abc');
    const hops = await screen.findByRole('list', { name: 'Hops' });
    const rows = hops.querySelectorAll('li');
    expect(rows).toHaveLength(2);
    expect(rows[0].querySelector('.title').textContent.trim()).toBe('bit.ly');
    expect(rows[0].querySelector('.meta').textContent.trim()).toBe('301');
    expect(rows[1].querySelector('.title').textContent.trim()).toBe('www.example.com');
    expect(rows[1].querySelector('.meta').textContent.trim()).toBe('200');

    const final = screen.getByRole('list', { name: 'Final destination' });
    expect(final.textContent).toContain('https://www.example.com/landing?ref=1');
    expect(final.querySelector('.badge').textContent.trim()).toBe('Safe');
    // The destination is shown, never linked: it may be the thing to avoid.
    expect(container.querySelector('[data-result] a')).toBeNull();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/tools/expand');
    expect(JSON.parse(init.body)).toEqual({ url: 'bit.ly/abc' });
  });

  it.each([
    ['blocked', /private or local network/i],
    ['too-many-hops', /10 hops/i],
    ['timeout', /5 seconds/i],
    ['error', /could not be reached/i],
    ['bad-url', /not an http or https link/i]
  ])('explains a chain stopped by %s', async (stopped, text) => {
    reply({ hops: [{ url: 'https://bit.ly/abc', status: 302 }], final: null, stopped, verdict: null });
    const { container } = render(Page);
    await submit('bit.ly/abc');
    await waitFor(() => expect(container.querySelector('[data-result]').textContent).toMatch(text));
    expect(screen.queryByRole('list', { name: 'Final destination' })).toBeNull();
  });

  it('shows a refused first link as a field error', async () => {
    reply({ hops: [], final: null, stopped: 'bad-url', verdict: null });
    const { container } = render(Page);
    await submit('http://example.com:8080/');
    await waitFor(() => expect(container.querySelector('[id$="-error"]').textContent).toMatch(/http or https/i));
  });

  it('shows the limit message as a field error', async () => {
    reply({ error: 'Too many checks. Try again in an hour.' }, 429);
    const { container } = render(Page);
    await submit('bit.ly/abc');
    await waitFor(() => expect(container.querySelector('[id$="-error"]').textContent).toBe('Too many checks. Try again in an hour.'));
  });

  it('refuses an invalid link without a request', async () => {
    const { container } = render(Page);
    await submit('not a link');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container.querySelector('[id$="-error"]').textContent).toMatch(/valid link/i);
  });

  it('reserves the result area before there is a result', () => {
    const { container } = render(Page);
    expect(container.querySelector('[data-result]')).not.toBeNull();
  });

  it('links to the shortener and the link checker', () => {
    render(Page);
    expect(screen.getByRole('link', { name: /shorten a link/i }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('link', { name: /link checker/i }).getAttribute('href')).toBe('/tools/link-checker');
  });

  it('is registered with an FAQ that says scripts are not followed', () => {
    const p = marketingPage('/tools/url-expander');
    expect(p.kind).toBe('tool');
    const data = JSON.stringify(p.structuredData());
    expect(data).toContain('FAQPage');
    expect(data).toMatch(/JavaScript/);
    render(Page);
    expect(screen.getByText('Does it open the page?')).toBeTruthy();
  });
});
