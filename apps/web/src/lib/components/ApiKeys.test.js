import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ApiKeys from './ApiKeys.svelte';

const SECRET = 'iksi_' + 'S'.repeat(43);
const laptop = { id: 7, name: 'Laptop', prefix: 'iksi_ab12', createdAt: '2026-10-15T12:00:00.000Z', lastUsedAt: null };
const work = {
  id: 8,
  name: 'Work Chrome',
  prefix: 'iksi_cd34',
  createdAt: '2025-03-03T12:00:00.000Z',
  lastUsedAt: '2026-10-20T12:00:00.000Z'
};

const ok = (body, status = 200) => ({ ok: true, status, json: async () => body });
const bad = (status, error) => ({ ok: false, status, json: async () => ({ error }) });

describe('ApiKeys', () => {
  let fetchMock;
  let writeText;
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lists each key by name, prefix, creation and last use, never the whole key', () => {
    render(ApiKeys, { props: { keys: [laptop, work] } });
    expect(screen.getByText('Laptop')).toBeInTheDocument();
    expect(screen.getByText('iksi_ab12…')).toBeInTheDocument();
    expect(screen.getByText('Created Oct 15, 2026 · Never used')).toBeInTheDocument();
    expect(screen.getByText('Created Mar 3, 2025 · Last used Oct 20, 2026')).toBeInTheDocument();
  });

  it('creates a named key and shows it once with a copy button', async () => {
    fetchMock.mockResolvedValue(ok({ secret: SECRET, keys: [laptop] }, 201));
    render(ApiKeys, { props: { keys: [] } });
    await fireEvent.input(screen.getByLabelText('Create a key'), { target: { value: 'Laptop' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Create key' }));

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/keys');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ name: 'Laptop' });

    expect(await screen.findByLabelText('New key')).toHaveValue(SECRET);
    expect(screen.getByText(/won't see this key again/)).toBeInTheDocument();
    expect(screen.getByText('iksi_ab12…')).toBeInTheDocument();
    expect(screen.getByLabelText('Create a key')).toHaveValue('');

    await fireEvent.click(screen.getByRole('button', { name: 'Copy key' }));
    expect(writeText).toHaveBeenCalledWith(SECRET);
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
  });

  it('forgets the key once dismissed', async () => {
    fetchMock.mockResolvedValue(ok({ secret: SECRET, keys: [laptop] }, 201));
    const { container } = render(ApiKeys, { props: { keys: [] } });
    await fireEvent.input(screen.getByLabelText('Create a key'), { target: { value: 'Laptop' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    await screen.findByLabelText('New key');
    await fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByLabelText('New key')).toBeNull();
    expect(container.innerHTML).not.toContain(SECRET);
  });

  it('says why a key was not created', async () => {
    fetchMock.mockResolvedValue(bad(400, 'Give the key a name.'));
    render(ApiKeys, { props: { keys: [] } });
    await fireEvent.input(screen.getByLabelText('Create a key'), { target: { value: 'x' } });
    await fireEvent.click(screen.getByRole('button', { name: 'Create key' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Give the key a name.');
    expect(screen.getByLabelText('Create a key')).toHaveValue('x');
  });

  it('cannot create without a name', () => {
    render(ApiKeys, { props: { keys: [] } });
    expect(screen.getByRole('button', { name: 'Create key' })).toBeDisabled();
  });

  it('stops offering new keys at the limit', () => {
    const keys = Array.from({ length: 10 }, (_, i) => ({ ...laptop, id: i + 1, name: `k${i}` }));
    render(ApiKeys, { props: { keys } });
    expect(screen.queryByRole('button', { name: 'Create key' })).toBeNull();
    expect(screen.getByText(/You have 10 keys/)).toBeInTheDocument();
  });

  it('revokes a key after a confirm step', async () => {
    fetchMock.mockResolvedValue(ok({ keys: [work] }));
    render(ApiKeys, { props: { keys: [laptop, work] } });
    await fireEvent.click(screen.getByRole('button', { name: 'Revoke Laptop' }));
    expect(fetchMock).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole('button', { name: 'Revoke key' }));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/keys?id=7');
    expect(init.method).toBe('DELETE');
    await vi.waitFor(() => expect(screen.queryByText('Laptop')).toBeNull());
    expect(screen.getByText('Work Chrome')).toBeInTheDocument();
  });

  it('can back out of revoking', async () => {
    render(ApiKeys, { props: { keys: [laptop] } });
    await fireEvent.click(screen.getByRole('button', { name: 'Revoke Laptop' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Revoke Laptop' })).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('says when a revoke failed', async () => {
    fetchMock.mockResolvedValue(bad(500, ''));
    render(ApiKeys, { props: { keys: [laptop] } });
    await fireEvent.click(screen.getByRole('button', { name: 'Revoke Laptop' }));
    await fireEvent.click(screen.getByRole('button', { name: 'Revoke key' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not revoke that key.');
    expect(screen.getByText('Laptop')).toBeInTheDocument();
  });
});
