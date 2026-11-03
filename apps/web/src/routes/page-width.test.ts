// One width per family of screens, so moving between them never shifts the
// page header or the content: every dashboard screen sits in the wide
// Container, and the reading pages (report, privacy) share the form width.
import { describe, it, expect } from 'vitest';

const raw = (files: Record<string, unknown>) => files as Record<string, string>;

const dashboard = raw(
  import.meta.glob('/src/routes/\\(app\\)/dashboard/**/+page.svelte', { query: '?raw', import: 'default', eager: true })
);
const reading = raw(
  import.meta.glob(['/src/routes/report/+page.svelte', '/src/routes/privacy/+page.svelte'], {
    query: '?raw',
    import: 'default',
    eager: true
  })
);

// Every <Container ...> opening tag in a file, with its width (form when unset).
function containerWidths(source: string) {
  return [...source.matchAll(/<Container\b([^>]*)>/g)].map((m) => m[1].match(/\bwidth="([a-z]+)"/)?.[1] ?? 'form');
}

describe('dashboard width', () => {
  it('covers every dashboard screen', () => {
    expect(Object.keys(dashboard).sort()).toEqual(
      expect.arrayContaining([
        '/src/routes/(app)/dashboard/+page.svelte',
        '/src/routes/(app)/dashboard/claim/+page.svelte',
        '/src/routes/(app)/dashboard/links/+page.svelte',
        '/src/routes/(app)/dashboard/profile/+page.svelte'
      ])
    );
  });

  it.each(Object.entries(dashboard))('%s sits in one wide Container', (_path, source) => {
    expect(containerWidths(source)).toEqual(['wide']);
  });

  // A screen that pads its own column would put its header lower than the rest.
  it.each(Object.entries(dashboard))('%s adds no top space of its own above the header', (_path, source) => {
    const classes = [...source.matchAll(/<Container\b[^>]*\bclass="([^"]+)"/g)].flatMap((m) => m[1].split(/\s+/));
    for (const c of classes) {
      expect(source).not.toMatch(new RegExp(`\\.${c}\\)?\\s*\\{[^}]*padding`));
    }
  });

  it('keeps the claim form narrow inside the wide column', () => {
    const claim = dashboard['/src/routes/(app)/dashboard/claim/+page.svelte'];
    expect(claim).toMatch(/max-width:\s*var\(--width-narrow\)/);
  });
});

describe('reading pages width', () => {
  it('covers report and privacy', () => {
    expect(Object.keys(reading)).toHaveLength(2);
  });

  it.each(Object.entries(reading))('%s sits in the form Container, with no width of its own', (_path, source) => {
    expect(containerWidths(source)).toEqual(['form']);
    expect(source).toMatch(/<Container\b[^>]*\bwidth="form"/);
    expect(source).not.toMatch(/max-width:\s*calc\(\d+px/);
  });
});
