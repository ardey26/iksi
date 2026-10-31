import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { purgeEdge } from './edge-purge';

const res = (status: number) => new Response(null, { status });

describe('purgeEdge', () => {
  beforeEach(() => {
    process.env.EDGE_SECRET = 'edge';
    delete process.env.EDGE_PURGE_URL;
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.EDGE_SECRET;
  });

  const run = async (p: Promise<boolean>) => {
    await vi.runAllTimersAsync();
    return p;
  };

  it('POSTs slugs with the edge header and returns true on 204', async () => {
    const f = vi.fn().mockResolvedValue(res(204));
    expect(await run(purgeEdge(['a', 'B'], f as never))).toBe(true);
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe('https://www.iksi.app/_edge/purge');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ slugs: ['a', 'B'] });
    expect(new Headers(init.headers).get('x-iksi-edge')).toBe('edge');
  });

  it('retries a 503 then succeeds', async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(503))
      .mockResolvedValueOnce(res(204));
    expect(await run(purgeEdge(['a'], f as never))).toBe(true);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('gives up after 3 attempts', async () => {
    const f = vi.fn().mockResolvedValue(res(503));
    expect(await run(purgeEdge(['a'], f as never))).toBe(false);
    expect(f).toHaveBeenCalledTimes(3);
  });

  it('does not retry a 4xx', async () => {
    const f = vi.fn().mockResolvedValue(res(401));
    expect(await run(purgeEdge(['a'], f as never))).toBe(false);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('is a no-op without EDGE_SECRET', async () => {
    delete process.env.EDGE_SECRET;
    const f = vi.fn();
    expect(await run(purgeEdge(['a'], f as never))).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it('is a no-op for empty slugs', async () => {
    const f = vi.fn();
    expect(await run(purgeEdge([], f as never))).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

  it('returns false when fetch throws', async () => {
    const f = vi.fn().mockRejectedValue(new Error('down'));
    expect(await run(purgeEdge(['a'], f as never))).toBe(false);
    expect(f).toHaveBeenCalledTimes(3);
  });
});
