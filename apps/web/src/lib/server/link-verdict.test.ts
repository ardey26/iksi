import { describe, it, expect, vi, beforeEach } from 'vitest';

const order = vi.hoisted(() => [] as string[]);
const update = vi.hoisted(() => vi.fn());
const updateMany = vi.hoisted(() => vi.fn());
const checkURL = vi.hoisted(() => vi.fn());
const purgeEdge = vi.hoisted(() => vi.fn());
const waitUntil = vi.hoisted(() => vi.fn());
vi.mock('@vercel/functions', () => ({ waitUntil }));
vi.mock('#lib/prisma.js', () => ({ prisma: { longURL: { update }, profileRow: { updateMany } } }));
vi.mock('#lib/server/safe-browsing.js', () => ({ checkURL }));
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
    checkURL.mockResolvedValue('malware');
    await settleVerdict('Xy', 'https://e.com');
    expect(order).toEqual(['update', 'quarantine', 'purge']);
    expect(purgeEdge).toHaveBeenCalledWith(['Xy']);
  });

  it('purges after update for a safe verdict without quarantining', async () => {
    checkURL.mockResolvedValue('safe');
    await settleVerdict('Xy', 'https://e.com');
    expect(order).toEqual(['update', 'purge']);
  });

  it('rejects when checkURL fails and purges nothing', async () => {
    checkURL.mockRejectedValue(new Error('x'));
    await expect(settleVerdict('Xy', 'https://e.com')).rejects.toThrow();
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
    checkURL.mockResolvedValue('safe');
    settleVerdictInBackground('Xy', 'https://e.com');
    expect(waitUntil).toHaveBeenCalledTimes(1);
    const p = waitUntil.mock.calls[0][0];
    expect(p).toBeInstanceOf(Promise);
    await p;
    expect(purgeEdge).toHaveBeenCalledWith(['Xy']);
  });

  it('never rejects when the check fails', async () => {
    checkURL.mockRejectedValue(new Error('x'));
    settleVerdictInBackground('Xy', 'https://e.com');
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
  });
});
