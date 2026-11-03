// The header account control shows the owner's photo, or a bare account
// icon when there is none: never a letter on a disc.
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import UserMenu from './UserMenu.svelte';

const user = (avatarUrl) => ({ twitterHandle: null, googleEmail: 'ana@x.com', handle: 'ana', displayName: 'Ana Reyes', avatarUrl });
const trigger = () => screen.getByRole('button', { name: 'Account menu' });

describe('UserMenu trigger', () => {
  it("shows the owner's photo", () => {
    render(UserMenu, { props: { user: user('https://cdn.example.com/a.webp') } });
    expect(trigger().querySelector('img')).toHaveAttribute('src', 'https://cdn.example.com/a.webp');
    expect(trigger()).toHaveClass('photo');
  });

  it('shows a bare account icon without a photo, and no letter', () => {
    render(UserMenu, { props: { user: user(null) } });
    expect(trigger().querySelector('svg.lucide-circle-user')).toHaveAttribute('aria-hidden', 'true');
    expect(trigger()).toHaveTextContent(/^$/);
    expect(trigger()).not.toHaveClass('photo');
  });

  it('falls back to the icon when the photo fails to load', async () => {
    render(UserMenu, { props: { user: user('https://cdn.example.com/gone.webp') } });
    await fireEvent.error(trigger().querySelector('img'));
    expect(trigger().querySelector('img')).toBeNull();
    expect(trigger().querySelector('svg.lucide-circle-user')).not.toBeNull();
  });
});
