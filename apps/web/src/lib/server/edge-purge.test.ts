import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { purgeEdge } from './edge-purge';

const res = (status: number) => new Response(null, { status });

describe('purgeEdge', () => {
  beforeEach(() => {
    process.env.EDGE_SECRET = 'edge';
    process.env.EDGE_ENABLED = 'true';
    delete process.env.EDGE_PURGE_URL;
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.EDGE_SECRET;
    delete process.env.EDGE_ENABLED;
  });

  const run = async (p: Promise<boolean>) => {
    await vi.runAllTimersAsync();
    return p;
  };

  it('does nothing while the edge layer is switched off', async () => {
    delete process.env.EDGE_ENABLED;
    const f = vi.fn().mockResolvedValue(res(204));
    expect(await run(purgeEdge(['a'], f as never))).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });

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

  it('bounds every attempt with a 2 s timeout signal', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const f = vi.fn().mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(204));
    expect(await run(purgeEdge(['a'], f as never))).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
    for (const [, init] of f.mock.calls) expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(timeout).toHaveBeenCalledTimes(2);
    expect(timeout).toHaveBeenCalledWith(2000);
  });

  it('treats a timed-out attempt as retryable', async () => {
    const timedOut = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const f = vi.fn().mockRejectedValueOnce(timedOut).mockResolvedValueOnce(res(204));
    expect(await run(purgeEdge(['a'], f as never))).toBe(true);
    expect(f).toHaveBeenCalledTimes(2);
  });

  const warned = () => JSON.stringify((console.warn as unknown as ReturnType<typeof vi.fn>).mock.calls);

  it('warns with the last status after giving up', async () => {
    const f = vi.fn().mockResolvedValue(res(503));
    await run(purgeEdge(['a'], f as never));
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(warned()).toContain('edge purge failed');
    expect(warned()).toContain('503');
  });

  it('warns with the status of a non-retried 4xx', async () => {
    const f = vi.fn().mockResolvedValue(res(401));
    await run(purgeEdge(['a'], f as never));
    expect(warned()).toContain('401');
  });

  it('warns with the last error message when fetch throws', async () => {
    const f = vi.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    await run(purgeEdge(['a'], f as never));
    expect(warned()).toContain('getaddrinfo ENOTFOUND');
  });

  it('returns false when fetch throws', async () => {
    const f = vi.fn().mockRejectedValue(new Error('down'));
    expect(await run(purgeEdge(['a'], f as never))).toBe(false);
    expect(f).toHaveBeenCalledTimes(3);
  });
});
