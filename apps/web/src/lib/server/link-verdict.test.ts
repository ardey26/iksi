import { describe, it, expect, vi, beforeEach } from 'vitest';

const order = vi.hoisted(() => [] as string[]);
const update = vi.hoisted(() => vi.fn());
const linkUpdateMany = vi.hoisted(() => vi.fn());
const updateMany = vi.hoisted(() => vi.fn());
const checkURLs = vi.hoisted(() => vi.fn());
const purgeEdge = vi.hoisted(() => vi.fn());
const waitUntil = vi.hoisted(() => vi.fn());
vi.mock('@vercel/functions', () => ({ waitUntil }));
vi.mock('#lib/prisma.js', () => ({ prisma: { longURL: { update, updateMany: linkUpdateMany }, profileRow: { updateMany } } }));
vi.mock('#lib/server/safe-browsing.js', () => ({ checkURLs }));
vi.mock('#lib/server/edge-purge.js', () => ({ purgeEdge }));

import { settleVerdict, settleVerdictInBackground } from './link-verdict';

describe('settleVerdict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    order.length = 0;
    update.mockImplementation(async () => { order.push('update'); });
    updateMany.mockImplementation(async () => { order.push('quarantine'); });
    purgeEdge.mockImplementation(async () => { order.push('purge'); return true; });
  });

  it('purges after the quarantine update for a flagged verdict', async () => {
    checkURLs.mockResolvedValue('malware');
    await settleVerdict('Xy', ['https://e.com']);
    expect(order).toEqual(['update', 'quarantine', 'purge']);
    expect(purgeEdge).toHaveBeenCalledWith(['Xy']);
  });

  it('purges after update for a safe verdict without quarantining', async () => {
    checkURLs.mockResolvedValue('safe');
    await settleVerdict('Xy', ['https://e.com']);
    expect(order).toEqual(['update', 'purge']);
  });

  it('checks the default and every rule destination in one lookup; a bad rule flags the link', async () => {
    checkURLs.mockImplementation(async (urls: string[]) =>
      urls.includes('https://bad.example/') ? 'phishing' : 'safe'
    );
    await settleVerdict('Xy', ['https://e.com/', 'https://bad.example/']);
    expect(checkURLs).toHaveBeenCalledTimes(1);
    expect(checkURLs).toHaveBeenCalledWith(['https://e.com/', 'https://bad.example/']);
    expect(update.mock.calls[0][0].data.safeVerdict).toBe('phishing');
    expect(order).toEqual(['update', 'quarantine', 'purge']);
  });

  it('an incomplete check (pending) only writes to a row that is not flagged', async () => {
    checkURLs.mockResolvedValue('pending');
    linkUpdateMany.mockImplementation(async () => { order.push('pending-if-unflagged'); return { count: 0 }; });
    await settleVerdict('Xy', ['https://e.com']);
    expect(update).not.toHaveBeenCalled();
    expect(linkUpdateMany.mock.calls[0][0].where).toEqual({
      shortURL: 'Xy',
      OR: [{ safeVerdict: null }, { safeVerdict: { notIn: ['malware', 'phishing', 'unwanted'] } }]
    });
    expect(linkUpdateMany.mock.calls[0][0].data.safeVerdict).toBe('pending');
    expect(order).toEqual(['pending-if-unflagged', 'purge']);
  });

  it('rejects when checkURLs fails and purges nothing', async () => {
    checkURLs.mockRejectedValue(new Error('x'));
    await expect(settleVerdict('Xy', ['https://e.com'])).rejects.toThrow();
    expect(purgeEdge).not.toHaveBeenCalled();
  });
});

describe('settleVerdictInBackground', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    update.mockResolvedValue({});
    purgeEdge.mockResolvedValue(true);
  });

  it('registers the verdict promise with waitUntil', async () => {
    checkURLs.mockResolvedValue('safe');
    settleVerdictInBackground('Xy', ['https://e.com']);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    const p = waitUntil.mock.calls[0][0];
    expect(p).toBeInstanceOf(Promise);
    await p;
    expect(purgeEdge).toHaveBeenCalledWith(['Xy']);
  });

  it('never rejects when the check fails', async () => {
    checkURLs.mockRejectedValue(new Error('x'));
    settleVerdictInBackground('Xy', ['https://e.com']);
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
  });
});
