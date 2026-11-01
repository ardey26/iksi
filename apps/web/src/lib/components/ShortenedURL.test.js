import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import ShortenedURL from './ShortenedURL.svelte';

describe('ShortenedURL', () => {
  it('shows a note in the reserved line when given one', () => {
    render(ShortenedURL, { props: { shortURL: 'AbCdEfGhJk', note: 'One-time link. It opens once.' } });
    expect(screen.getByText('One-time link. It opens once.')).toBeInTheDocument();
  });

  it('keeps the reserved line empty by default', () => {
    const { container } = render(ShortenedURL, { props: { shortURL: 'AbC' } });
    expect(container.querySelector('.note')?.textContent?.trim()).toBe('');
  });

  describe('copy feedback', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('swaps the label in place: both labels hold the width', async () => {
      vi.stubGlobal('isSecureContext', true);
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn(async () => {}) } });
      const { container } = render(ShortenedURL, { props: { shortURL: 'AbC' } });
      const swap = container.querySelector('.actions .swap');
      const [idle, done] = swap.children;
      expect(idle).toHaveTextContent('Copy link');
      expect(done).toHaveTextContent('Copied');
      expect(done).toHaveClass('off');
      await fireEvent.click(screen.getByRole('button', { name: /Copy link/ }));
      await waitFor(() => expect(idle).toHaveClass('off'));
      // Same nodes, both still laid out; only which one is visible changed.
      expect(swap.children).toHaveLength(2);
      expect(done).not.toHaveClass('off');
      expect(screen.getByText('Link copied')).toBeInTheDocument();
    });
  });
});
