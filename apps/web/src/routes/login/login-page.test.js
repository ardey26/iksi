// The sign-in page is a public interstitial (DESIGN.md › Layout): a centered
// 480 column, one paper, the brand mark, a Title, one line, the provider
// buttons, and a way back home. The forms post to the same OAuth actions.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';

const page = vi.hoisted(() => ({ url: new URL('https://www.iksi.app/login'), route: { id: '/login' } }));
vi.mock('$app/state', () => ({ page, navigating: { to: null } }));

import Login from './+page.svelte';

afterEach(cleanup);

describe('login page', () => {
  it('is one paper in the narrow column, with the brand mark and a Title', () => {
    const { container } = render(Login, { props: { form: null } });
    expect(container.querySelectorAll('.paper')).toHaveLength(1);
    expect(container.querySelector('.page-column.narrow .paper')).not.toBeNull();
    expect(container.querySelector('.paper .brand-mark')).not.toBeNull();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Sign in to iksi');
    expect(h1).toHaveClass('t-title');
    // One line of copy.
    expect(container.querySelectorAll('.paper p.desc')).toHaveLength(1);
  });

  it('posts to the same OAuth actions with kit buttons and provider icons', () => {
    const { container } = render(Login, { props: { form: null } });
    const forms = [...container.querySelectorAll('form')];
    expect(forms.map((f) => [f.getAttribute('method'), f.getAttribute('action')])).toEqual([
      ['POST', '?/twitter'],
      ['POST', '?/google']
    ]);
    for (const [name, provider] of [
      ['Continue with X', 'x'],
      ['Continue with Google', 'google']
    ]) {
      const btn = screen.getByRole('button', { name });
      expect(btn).toHaveAttribute('data-ui');
      expect(btn).toHaveAttribute('type', 'submit');
      expect(btn.querySelector(`svg[data-provider="${provider}"]`)).not.toBeNull();
    }
    expect(screen.getByRole('button', { name: 'Continue with X' })).toHaveClass('primary');
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toHaveClass('secondary');
  });

  it('disables the other provider while one redirects', async () => {
    const { container } = render(Login, { props: { form: null } });
    container.querySelectorAll('form')[1].addEventListener('submit', (e) => e.preventDefault());
    await fireEvent.submit(container.querySelectorAll('form')[1]);
    expect(screen.getByRole('button', { name: 'Continue with X' })).toBeDisabled();
    // Kit loading: a spinner, the label keeps its width and its name.
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toHaveAttribute('aria-busy', 'true');
  });

  it('links back home', () => {
    render(Login, { props: { form: null } });
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
  });

  it('shows an action error as an alert', () => {
    render(Login, { props: { form: { error: 'Google OAuth not configured' } } });
    expect(screen.getByRole('alert')).toHaveTextContent('Google OAuth not configured');
  });
});
