// No placeholder marks that carry no information: a grey tile with a letter
// (the old kit Monogram) or an initials avatar. Leading media shows something
// real (an avatar, a favicon, a logo) or a bare kit icon, or nothing at all.
import { describe, it, expect } from 'vitest';

const sources = import.meta.glob(['/src/**/*.{svelte,ts,js}', '!/src/no-letter-tiles.test.ts'], {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

describe('no letter tiles', () => {
  it('scans the whole app', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(200);
  });

  it.each(Object.entries(sources))('%s has no monogram or initials avatar', (_path, source) => {
    expect(source).not.toMatch(/monogram/i);
    expect(source).not.toMatch(/initials/i);
  });
});
