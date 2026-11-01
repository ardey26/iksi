import { describe, it, expect, vi, beforeEach } from 'vitest';

const env = vi.hoisted(() => ({ dev: false }));
vi.mock('$app/environment', () => ({
  get dev() {
    return env.dev;
  },
  browser: false,
  building: false,
  version: 'test'
}));

describe('/dev/ui', () => {
  beforeEach(() => vi.resetModules());

  it('404s outside development', async () => {
    env.dev = false;
    const { load } = await import('./+page.server');
    let thrown: unknown;
    try {
      (load as () => unknown)();
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toMatchObject({ status: 404 });
  });

  it('renders in development', async () => {
    env.dev = true;
    const { load } = await import('./+page.server');
    expect((load as () => unknown)()).toEqual({});
  });
});
