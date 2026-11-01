import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ShortenedURL from './ShortenedURL.svelte';

describe('ShortenedURL', () => {
  it('shows a note in the reserved line when given one', () => {
    render(ShortenedURL, { props: { shortURL: 'AbCdEfGhJk', note: 'One-time link. It opens once.' } });
    expect(screen.getByText('One-time link. It opens once.')).toBeInTheDocument();
  });

  it('keeps the reserved line empty by default', () => {
    const { container } = render(ShortenedURL, { props: { shortURL: 'AbC' } });
    expect(container.querySelector('.h-5')?.textContent?.trim()).toBe('');
  });
});
