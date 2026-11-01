import { describe, it, expect, vi } from 'vitest';
import {
  API_ORIGIN,
  ERRORS,
  MENU,
  buildShortenRequest,
  isKeyFormat,
  isShortenable,
  keyPrefix,
  readShortenResponse,
  shortLinkOf,
  shortenUrl,
  targetOf
} from '../src/shorten.js';

const KEY = 'iksi_' + 'Ab3-_'.repeat(8) + 'xyz';
const PAGE = 'https://example.com/a/long/page?x=1#top';

describe('isKeyFormat', () => {
  it.each([
    [KEY, true],
    ['  ' + KEY + '  ', false],
    ['iksi_' + 'a'.repeat(42), false],
    ['iksi_' + 'a'.repeat(44), false],
    ['IKSI_' + 'a'.repeat(43), false],
    ['iksi_' + 'a'.repeat(42) + '+', false],
    ['', false],
    [undefined, false]
  ])('%s → %s', (k, ok) => expect(isKeyFormat(k)).toBe(ok));
});

describe('keyPrefix', () => {
  it('shows only the first characters of a key', () => {
    expect(keyPrefix(KEY)).toBe(KEY.slice(0, 9) + '…');
    expect(keyPrefix(KEY)).not.toContain(KEY.slice(9));
  });
});

describe('isShortenable', () => {
  it.each([
    ['https://example.com/', true],
    ['http://example.com/x', true],
    ['chrome://extensions', false],
    ['chrome-extension://abc/popup.html', false],
    ['about:blank', false],
    ['file:///Users/me/a.pdf', false],
    ['javascript:alert(1)', false],
    ['not a url', false],
    ['', false],
    [undefined, false],
    ['https://example.com/' + 'a'.repeat(2048), false]
  ])('%s → %s', (u, ok) => expect(isShortenable(u)).toBe(ok));
});

describe('context menu', () => {
  it('offers one item on links and one on pages', () => {
    expect(MENU.link).toMatchObject({ title: 'Shorten link with iksi', contexts: ['link'] });
    expect(MENU.page).toMatchObject({ title: 'Shorten this page with iksi', contexts: ['page'] });
    expect(MENU.link.id).not.toBe(MENU.page.id);
  });

  it('shortens the link that was right-clicked', () => {
    expect(targetOf({ menuItemId: MENU.link.id, linkUrl: 'https://a.example/', pageUrl: PAGE }, { url: PAGE })).toBe(
      'https://a.example/'
    );
  });

  it('shortens the page, falling back to the tab URL', () => {
    expect(targetOf({ menuItemId: MENU.page.id, pageUrl: PAGE }, undefined)).toBe(PAGE);
    expect(targetOf({ menuItemId: MENU.page.id }, { url: PAGE })).toBe(PAGE);
  });

  it('ignores menu items it does not own', () => {
    expect(targetOf({ menuItemId: 'other', pageUrl: PAGE }, { url: PAGE })).toBeNull();
  });
});

describe('buildShortenRequest', () => {
  it('posts JSON to the shorten API with the key as a bearer token and no cookies', () => {
    const { url, init } = buildShortenRequest(KEY, PAGE);
    expect(url).toBe('https://www.iksi.app/api/shorten');
    expect(url.startsWith(API_ORIGIN)).toBe(true);
    expect(init.method).toBe('POST');
    // SvelteKit refuses cross-origin POSTs without a JSON content type.
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(init.credentials).toBe('omit');
    expect(init.cache).toBe('no-store');
    expect(JSON.parse(init.body)).toEqual({ longURL: PAGE });
  });
});

describe('shortLinkOf', () => {
  it('builds the link to copy and a short label', () => {
    expect(shortLinkOf('Ab3xYz9')).toEqual({ url: 'https://www.iksi.app/Ab3xYz9', label: 'iksi.app/Ab3xYz9' });
  });
});

describe('readShortenResponse', () => {
  it('returns the short link on success', () => {
    expect(readShortenResponse(200, { shortURL: 'Ab3xYz9' })).toEqual({
      ok: true,
      url: 'https://www.iksi.app/Ab3xYz9',
      label: 'iksi.app/Ab3xYz9'
    });
  });

  it.each([
    [401, { error: 'Invalid API key', code: 'invalid_key' }, 'bad_key'],
    [429, { error: 'Too many requests' }, 'rate_limited'],
    [400, { error: 'you provided an invalid URL' }, 'bad_url'],
    [413, { error: 'Request body too large' }, 'bad_url'],
    [500, { error: 'Internal server error' }, 'server'],
    [503, {}, 'server'],
    [200, {}, 'server'],
    [200, { shortURL: '' }, 'server'],
    [302, null, 'server']
  ])('maps %i to %s', (status, body, code) => {
    const r = readShortenResponse(status, body);
    expect(r.ok).toBe(false);
    expect(r.code).toBe(code);
    expect(typeof r.message).toBe('string');
    expect(r.message.length).toBeGreaterThan(0);
  });

  it("passes on the server's reason for a refused URL, in sentence case", () => {
    expect(readShortenResponse(400, { error: 'you provided an invalid URL' }).message).toBe('You provided an invalid URL.');
    expect(readShortenResponse(400, {}).message).toBe(ERRORS.bad_url);
  });

  it('every error code has a plain message', () => {
    for (const code of ['no_key', 'bad_key', 'rate_limited', 'bad_url', 'unsupported', 'network', 'server']) {
      expect(ERRORS[code]).toMatch(/^([A-Z]|iksi ).*\.$/);
    }
  });
});

describe('shortenUrl', () => {
  const ok = (body, status = 200) => ({ status, json: async () => body });

  it('asks for a key when none is saved, without calling the API', async () => {
    const fetch = vi.fn();
    expect(await shortenUrl({ key: '', url: PAGE, fetch })).toMatchObject({ ok: false, code: 'no_key' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('calls a malformed saved key bad, without sending it', async () => {
    const fetch = vi.fn();
    expect(await shortenUrl({ key: 'iksi_nope', url: PAGE, fetch })).toMatchObject({ ok: false, code: 'bad_key' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refuses pages that are not on the web', async () => {
    const fetch = vi.fn();
    expect(await shortenUrl({ key: KEY, url: 'chrome://settings', fetch })).toMatchObject({ code: 'unsupported' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shortens through the API', async () => {
    const fetch = vi.fn(async () => ok({ shortURL: 'Ab3xYz9' }));
    expect(await shortenUrl({ key: KEY, url: PAGE, fetch })).toEqual({
      ok: true,
      url: 'https://www.iksi.app/Ab3xYz9',
      label: 'iksi.app/Ab3xYz9'
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://www.iksi.app/api/shorten');
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
  });

  it('reports a network failure', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await shortenUrl({ key: KEY, url: PAGE, fetch })).toMatchObject({ ok: false, code: 'network' });
  });

  it('copes with a body that is not JSON', async () => {
    const fetch = vi.fn(async () => ({ status: 502, json: async () => JSON.parse('<html>') }));
    expect(await shortenUrl({ key: KEY, url: PAGE, fetch })).toMatchObject({ ok: false, code: 'server' });
  });

  it('never puts the key in an error message', async () => {
    const fetch = vi.fn(async () => ok({ error: `bad ${KEY}` }, 400));
    const r = await shortenUrl({ key: KEY, url: PAGE, fetch });
    expect(r.message).not.toContain(KEY.slice(9));
  });
});
