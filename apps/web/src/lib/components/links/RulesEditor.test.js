import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/svelte';
import RulesEditor from './RulesEditor.svelte';

const mk = (id, extra = {}) => ({ id, conditions: [], mode: 'single', destination: `https://${id}.example.com`, split: [], ...extra });
const ids = () => screen.queryAllByRole('group', { name: /^Rule \d+$/ }).map((g) => g.getAttribute('data-rule'));
const click = (name) => fireEvent.click(screen.getByRole('button', { name }));
const focused = () => document.activeElement;

describe('RulesEditor', () => {
  it('moves rules up and down', async () => {
    render(RulesEditor, { props: { rules: [mk('aaaaaaa1'), mk('aaaaaaa2'), mk('aaaaaaa3')] } });
    await click('Move rule 2 up');
    expect(ids()).toEqual(['aaaaaaa2', 'aaaaaaa1', 'aaaaaaa3']);
    await click('Move rule 2 down');
    expect(ids()).toEqual(['aaaaaaa2', 'aaaaaaa3', 'aaaaaaa1']);
  });

  it('keeps focus on a move button when the rule lands at an edge', async () => {
    render(RulesEditor, { props: { rules: [mk('aaaaaaa1'), mk('aaaaaaa2')] } });
    await click('Move rule 2 up');
    await waitFor(() => expect(focused()).toBe(screen.getByRole('button', { name: 'Move rule 1 down' })));
    await click('Move rule 1 down');
    await waitFor(() => expect(focused()).toBe(screen.getByRole('button', { name: 'Move rule 2 up' })));
  });

  it('keeps focus on the same move button when it stays enabled', async () => {
    render(RulesEditor, { props: { rules: [mk('aaaaaaa1'), mk('aaaaaaa2'), mk('aaaaaaa3')] } });
    await click('Move rule 3 up');
    await waitFor(() => expect(focused()).toBe(screen.getByRole('button', { name: 'Move rule 2 up' })));
  });

  it('removes a rule and focuses the next rule, else Add rule', async () => {
    render(RulesEditor, { props: { rules: [mk('aaaaaaa1'), mk('aaaaaaa2')] } });
    await click('Remove rule 1');
    expect(ids()).toEqual(['aaaaaaa2']);
    await waitFor(() => expect(focused()).toBe(screen.getByRole('button', { name: 'Remove rule 1' })));
    await click('Remove rule 1');
    expect(ids()).toEqual([]);
    await waitFor(() => expect(focused()).toBe(screen.getByRole('button', { name: 'Add rule' })));
  });

  it('focuses the new condition input', async () => {
    render(RulesEditor, { props: { rules: [mk('aaaaaaa1')] } });
    await click('Add condition');
    await click('Country');
    await waitFor(() => expect(focused()).toBe(screen.getByLabelText('Countries')));
  });

  it('opens the condition picker with only the unused kinds', async () => {
    render(RulesEditor, { props: { rules: [mk('aaaaaaa1', { conditions: [{ kind: 'country', values: 'SG' }] })] } });
    const add = screen.getByRole('button', { name: 'Add condition' });
    expect(add).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('group', { name: 'Condition type' })).toBeNull();
    await fireEvent.click(add);
    expect(add).toHaveAttribute('aria-expanded', 'true');
    const picker = screen.getByRole('group', { name: 'Condition type' });
    const kinds = within(picker).getAllByRole('button').map((b) => b.textContent.trim());
    expect(kinds).toEqual(['Continent', 'Device', 'Operating system', 'Referrer', 'Time of day']);
    await waitFor(() => expect(focused()).toBe(within(picker).getByRole('button', { name: 'Continent' })));
  });

  it('closes the picker on Escape and returns focus to Add condition', async () => {
    render(RulesEditor, { props: { rules: [mk('aaaaaaa1')] } });
    await click('Add condition');
    const picker = screen.getByRole('group', { name: 'Condition type' });
    await fireEvent.keyDown(within(picker).getByRole('button', { name: 'Country' }), { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Condition type' })).toBeNull();
    await waitFor(() => expect(focused()).toBe(screen.getByRole('button', { name: 'Add condition' })));
  });

  it('focuses Add condition after removing a condition', async () => {
    render(RulesEditor, { props: { rules: [mk('aaaaaaa1', { conditions: [{ kind: 'country', values: 'SG' }] })] } });
    await click('Remove Country condition');
    await waitFor(() => expect(focused()).toBe(screen.getByRole('button', { name: 'Add condition' })));
  });

  it('focuses a neighbour after removing a split row', async () => {
    const split = [
      { destination: 'https://a.example.com', weight: '40' },
      { destination: 'https://b.example.com', weight: '30' },
      { destination: 'https://c.example.com', weight: '30' }
    ];
    render(RulesEditor, { props: { rules: [mk('aaaaaaa1', { mode: 'split', split })] } });
    await click('Remove split row 1');
    await waitFor(() => expect(focused()).toBe(screen.getByLabelText('Split destination 1')));
    expect(screen.getByLabelText('Split destination 1')).toHaveValue('https://b.example.com');
  });

  it('disables Add rule at 20 rules', async () => {
    const many = Array.from({ length: 20 }, (_, i) => mk(`rule000${String(i).padStart(2, '0')}`.slice(-8)));
    render(RulesEditor, { props: { rules: many } });
    expect(screen.getByRole('button', { name: 'Add rule' })).toBeDisabled();
    await click('Remove rule 1');
    expect(screen.getByRole('button', { name: 'Add rule' })).toBeEnabled();
  });
});
