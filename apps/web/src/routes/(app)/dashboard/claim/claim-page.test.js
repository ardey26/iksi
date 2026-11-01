// New handles must be valid subdomain labels: the claim page says why a
// handle cannot be claimed before it is sent.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import Claim from './+page.svelte';

afterEach(cleanup);

const user = (twitterHandle, googleEmail = null) => ({ data: { user: { twitterHandle, googleEmail } } });
const field = () => screen.getByLabelText('Handle');
const claim = () => screen.getByRole('button', { name: /^Claim @/ });

describe('claim page', () => {
  it('suggests a valid handle from an X handle with underscores', () => {
    render(Claim, { props: user('_ann_reyes_') });
    expect(field()).toHaveValue('ann-reyes');
    expect(claim()).toBeEnabled();
  });

  it('says why an underscore cannot be used, and does not claim', async () => {
    render(Claim, { props: user(null, 'x@y.com') });
    await fireEvent.input(field(), { target: { value: 'ann_reyes' } });
    expect(screen.getByText('Use letters, numbers and hyphens. No underscores.')).toBeInTheDocument();
    expect(claim()).toBeDisabled();
  });

  it('says why an edge hyphen cannot be used', async () => {
    render(Claim, { props: user(null, 'x@y.com') });
    await fireEvent.input(field(), { target: { value: 'ann-' } });
    expect(screen.getByText("A handle can't start or end with a hyphen.")).toBeInTheDocument();
    expect(claim()).toBeDisabled();
  });

  it('accepts a hyphenated handle', async () => {
    render(Claim, { props: user(null, 'x@y.com') });
    await fireEvent.input(field(), { target: { value: 'ann-reyes' } });
    expect(claim()).toBeEnabled();
    expect(claim()).toHaveTextContent('Claim @ann-reyes');
  });
});
