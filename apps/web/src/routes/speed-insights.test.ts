// The plain `@vercel/speed-insights/sveltekit` entry reads `$app/stores`,
// which SvelteKit 3 removed: it threw on load and no page hydrated. Only
// the browser shows that, so the build and the other tests never caught it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Vitest runs from apps/web.
const source = readFileSync(resolve(process.cwd(), 'src/routes/+layout.ts'), 'utf8');

describe('speed insights', () => {
  it('uses the $app/state entry, never the $app/stores one', () => {
    expect(source).toContain("from '@vercel/speed-insights/sveltekit-next'");
    expect(source).not.toMatch(/@vercel\/speed-insights\/sveltekit['"]/);
  });

  it('only runs in the browser, outside vite dev', () => {
    expect(source).toMatch(/if \(browser && !import\.meta\.env\.DEV\) injectSpeedInsights\(\)/);
  });
});
