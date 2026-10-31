import { describe, it, expect, vi, beforeEach } from 'vitest';

const order = vi.hoisted(() => [] as string[]);
const linkUpdateMany = vi.hoisted(() => vi.fn());
const updateMany = vi.hoisted(() => vi.fn());
const checkURLs = vi.hoisted(() => vi.fn());
const purgeEdge = vi.hoisted(() => vi.fn());
const waitUntil = vi.hoisted(() => vi.fn());
vi.mock('@vercel/functions', () => ({ waitUntil }));
vi.mock('#lib/prisma.js', () => ({ prisma: { longURL: { updateMany: linkUpdateMany }, profileRow: { updateMany } } }));
vi.mock('#lib/server/safe-browsing.js', () => ({ checkURLs }));
vi.mock('#lib/server/edge-purge.js', () => ({ purgeEdge }));

import { settleVerdict, settleVerdictInBackground } from './link-verdict';

describe('settleVerdict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    order.length = 0;
    linkUpdateMany.mockImplementation(async () => { order.push('update'); return { count: 1 }; });
    updateMany.mockImplementation(async () => { order.push('quarantine'); });
    purgeEdge.mockImplementation(async () => { order.push('purge'); return true; });
  });

  it('purges after the quarantine update for a flagged verdict', async () => {
    checkURLs.mockResolvedValue('malware');
    await settleVerdict('Xy', ['https://e.com'], 3);
    expect(order).toEqual(['update', 'quarantine', 'purge']);
    expect(purgeEdge).toHaveBeenCalledWith(['Xy']);
  });

  it('purges after update for a safe verdict without quarantining', async () => {
    checkURLs.mockResolvedValue('safe');
    await settleVerdict('Xy', ['https://e.com'], 3);
    expect(order).toEqual(['update', 'purge']);
  });

  it('checks the default and every rule destination in one lookup; a bad rule flags the link', async () => {
    checkURLs.mockImplementation(async (urls: string[]) =>
      urls.includes('https://bad.example/') ? 'phishing' : 'safe'
    );
    await settleVerdict('Xy', ['https://e.com/', 'https://bad.example/'], 3);
    expect(checkURLs).toHaveBeenCalledTimes(1);
    expect(checkURLs).toHaveBeenCalledWith(['https://e.com/', 'https://bad.example/']);
    expect(linkUpdateMany.mock.calls[0][0].data.safeVerdict).toBe('phishing');
    expect(order).toEqual(['update', 'quarantine', 'purge']);
  });

  it('an incomplete check (pending) only writes to a row that is not flagged', async () => {
    checkURLs.mockResolvedValue('pending');
    linkUpdateMany.mockImplementation(async () => { order.push('pending-if-unflagged'); return { count: 0 }; });
    await settleVerdict('Xy', ['https://e.com'], 3);
    expect(linkUpdateMany.mock.calls[0][0].where).toEqual({
      shortURL: 'Xy',
      settingsVersion: 3,
      OR: [{ safeVerdict: null }, { safeVerdict: { notIn: ['malware', 'phishing', 'unwanted'] } }]
    });
    expect(linkUpdateMany.mock.calls[0][0].data.safeVerdict).toBe('pending');
    // Nothing matched (the row was flagged), so there is nothing to purge.
    expect(order).toEqual(['pending-if-unflagged']);
  });

  it('writes only to the settings version that was checked', async () => {
    checkURLs.mockResolvedValue('safe');
    await settleVerdict('Xy', ['https://e.com'], 3);
    expect(linkUpdateMany.mock.calls[0][0].where).toEqual({ shortURL: 'Xy', settingsVersion: 3 });
  });

  it.each(['safe', 'malware'])('a %s verdict for a superseded version writes nothing more and purges nothing', async (v) => {
    checkURLs.mockResolvedValue(v);
    linkUpdateMany.mockImplementation(async () => { order.push('stale'); return { count: 0 }; });
    await settleVerdict('Xy', ['https://e.com'], 3);
    expect(order).toEqual(['stale']);
    expect(updateMany).not.toHaveBeenCalled();
    expect(purgeEdge).not.toHaveBeenCalled();
  });

  it('rejects when checkURLs fails and purges nothing', async () => {
    checkURLs.mockRejectedValue(new Error('x'));
    await expect(settleVerdict('Xy', ['https://e.com'], 3)).rejects.toThrow();
    expect(purgeEdge).not.toHaveBeenCalled();
  });
});

describe('settleVerdictInBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    linkUpdateMany.mockResolvedValue({ count: 1 });
    purgeEdge.mockResolvedValue(true);
  });

  it('registers the verdict promise with waitUntil', async () => {
    checkURLs.mockResolvedValue('safe');
    settleVerdictInBackground('Xy', ['https://e.com'], 3);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    const p = waitUntil.mock.calls[0][0];
    expect(p).toBeInstanceOf(Promise);
    await p;
    expect(purgeEdge).toHaveBeenCalledWith(['Xy']);
  });

  it('never rejects when the check fails', async () => {
    checkURLs.mockRejectedValue(new Error('x'));
    settleVerdictInBackground('Xy', ['https://e.com'], 3);
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
  });
});
