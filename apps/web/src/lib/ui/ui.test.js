import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';

import Button from './Button.svelte';
import ButtonHarness from './tests/ButtonHarness.svelte';
import Input from './Input.svelte';
import Select from './Select.svelte';
import Textarea from './Textarea.svelte';
import Switch from './Switch.svelte';
import Segmented from './Segmented.svelte';
import ChipGroup from './ChipGroup.svelte';
import Logo from './Logo.svelte';
import Section from './Section.svelte';
import RowHarness from './tests/RowHarness.svelte';
import SheetHarness from './tests/SheetHarness.svelte';
import ToastHarness from './tests/ToastHarness.svelte';
import { toast, toasts, dismiss } from './toast.js';

describe('Button', () => {
  it('is disabled and busy while loading, with its label still in place', async () => {
    const { rerender } = render(ButtonHarness, { props: { loading: false } });
    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button).not.toBeDisabled();
    await rerender({ loading: true });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    // The label is still laid out (hidden by opacity, not removed), so the
    // width holds and the button keeps its accessible name.
    expect(screen.getByRole('button', { name: 'Save changes' })).toBe(button);
    expect(button.querySelector('.label')).toHaveTextContent('Save changes');
    expect(button.querySelector('.busy')).not.toBeNull();
    await rerender({ loading: false });
    expect(button).not.toBeDisabled();
    expect(button).not.toHaveAttribute('aria-busy');
  });

  it('renders a link when given href, and drops it when disabled', async () => {
    const { rerender } = render(Button, { props: { href: '/dashboard' } });
    expect(screen.getByRole('link')).toHaveAttribute('href', '/dashboard');
    await rerender({ href: '/dashboard', disabled: true });
    const a = document.querySelector('a');
    expect(a).not.toHaveAttribute('href');
    expect(a).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('Field', () => {
  it('wires the label to the input and the hint to its description', () => {
    render(Input, { props: { label: 'Destination', hint: 'https:// is added if missing' } });
    const input = screen.getByLabelText('Destination');
    expect(input.tagName).toBe('INPUT');
    expect(input).toHaveAccessibleDescription('https:// is added if missing');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('replaces the hint with the error, marks the input invalid and announces it', async () => {
    const { rerender } = render(Input, { props: { label: 'Click limit', hint: 'Empty means no limit' } });
    const input = screen.getByLabelText('Click limit');
    const live = document.getElementById(`${input.id}-error`);
    expect(live).toHaveAttribute('aria-live', 'polite');
    expect(live).toHaveTextContent('');

    await rerender({ label: 'Click limit', hint: 'Empty means no limit', error: 'Enter a whole number' });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a whole number');
    expect(live).toHaveTextContent('Enter a whole number');
    expect(screen.queryByText('Empty means no limit')).toBeNull();
  });

  it('gives every field its own ids', () => {
    render(Input, { props: { label: 'First', hint: 'One' } });
    render(Input, { props: { label: 'Second', hint: 'Two' } });
    const a = screen.getByLabelText('First');
    const b = screen.getByLabelText('Second');
    expect(a.id).not.toBe(b.id);
    expect(b).toHaveAccessibleDescription('Two');
  });

  it('wires select and textarea the same way', () => {
    render(Select, {
      props: { label: 'Expiry', hint: 'In your time zone', options: [{ value: 'never', label: 'Never' }] }
    });
    render(Textarea, { props: { label: 'Note', error: 'Too long' } });
    expect(screen.getByLabelText('Expiry').tagName).toBe('SELECT');
    expect(screen.getByLabelText('Expiry')).toHaveAccessibleDescription('In your time zone');
    expect(screen.getByLabelText('Note')).toHaveAccessibleDescription('Too long');
    expect(screen.getByLabelText('Note')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('Switch', () => {
  it('toggles aria-checked and reports the new state', async () => {
    const onChange = vi.fn();
    render(Switch, { props: { label: 'Password protected' }, events: { change: (e) => onChange(e.detail) } });
    const sw = screen.getByRole('switch', { name: 'Password protected' });
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await fireEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(onChange).toHaveBeenLastCalledWith({ checked: true });
    await fireEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });

  it('does not toggle when disabled', async () => {
    render(Switch, { props: { label: 'Locked', disabled: true } });
    const sw = screen.getByRole('switch', { name: 'Locked' });
    await fireEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'false');
  });
});

describe('Segmented', () => {
  const options = [
    { value: '302', label: 'Temporary' },
    { value: '301', label: 'Permanent' },
    { value: 'off', label: 'Off', disabled: true },
    { value: 'meta', label: 'Meta refresh' }
  ];

  it('is a radiogroup with one tab stop on the selected option', () => {
    render(Segmented, { props: { options, value: '301', label: 'Redirect type' } });
    expect(screen.getByRole('radiogroup', { name: 'Redirect type' })).toBeInTheDocument();
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('tabindex'))).toEqual(['-1', '0', '-1', '-1']);
    expect(screen.getByRole('radio', { name: 'Permanent' })).toHaveAttribute('aria-checked', 'true');
  });

  it('moves and selects with arrow keys, skipping disabled options and wrapping', async () => {
    render(Segmented, { props: { options, value: '302', label: 'Redirect type' } });
    const temporary = screen.getByRole('radio', { name: 'Temporary' });
    temporary.focus();

    await fireEvent.keyDown(temporary, { key: 'ArrowRight' });
    const permanent = screen.getByRole('radio', { name: 'Permanent' });
    expect(permanent).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(permanent);

    await fireEvent.keyDown(permanent, { key: 'ArrowRight' });
    const meta = screen.getByRole('radio', { name: 'Meta refresh' });
    expect(meta).toHaveAttribute('aria-checked', 'true');

    await fireEvent.keyDown(meta, { key: 'ArrowRight' });
    expect(temporary).toHaveAttribute('aria-checked', 'true');
    expect(document.activeElement).toBe(temporary);

    await fireEvent.keyDown(temporary, { key: 'ArrowLeft' });
    expect(meta).toHaveAttribute('aria-checked', 'true');

    await fireEvent.keyDown(meta, { key: 'Home' });
    expect(temporary).toHaveAttribute('aria-checked', 'true');
    await fireEvent.keyDown(temporary, { key: 'End' });
    expect(meta).toHaveAttribute('aria-checked', 'true');
    expect(meta).toHaveAttribute('tabindex', '0');
    expect(temporary).toHaveAttribute('tabindex', '-1');
  });
});

describe('ChipGroup', () => {
  it('toggles values as checkboxes', async () => {
    const options = [
      { value: 'ios', label: 'iOS' },
      { value: 'android', label: 'Android' }
    ];
    render(ChipGroup, { props: { options, value: ['ios'], label: 'Devices' } });
    expect(screen.getByRole('group', { name: 'Devices' })).toBeInTheDocument();
    const ios = screen.getByRole('checkbox', { name: 'iOS' });
    const android = screen.getByRole('checkbox', { name: 'Android' });
    expect(ios).toBeChecked();
    expect(android).not.toBeChecked();
    await fireEvent.click(android);
    expect(android).toBeChecked();
    await fireEvent.click(ios);
    expect(ios).not.toBeChecked();
  });
});

describe('Sheet', () => {
  it('opens as a modal dialog and moves focus into it', async () => {
    render(SheetHarness);
    expect(screen.queryByRole('dialog')).toBeNull();
    await fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    const dialog = await screen.findByRole('dialog', { name: 'Link settings' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('Changes save when you press Save.');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  });

  it('keeps Tab inside the sheet in both directions', async () => {
    render(SheetHarness);
    await fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    const dialog = await screen.findByRole('dialog');
    const close = screen.getByRole('button', { name: 'Close' });
    const save = screen.getByRole('button', { name: 'Save' });

    save.focus();
    await fireEvent.keyDown(save, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    await fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(save);

    // From the dialog itself (initial focus), Shift+Tab wraps to the end.
    dialog.focus();
    await fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(save);
  });

  it('pulls focus back if it escapes', async () => {
    render(SheetHarness);
    const opener = screen.getByRole('button', { name: 'Open settings' });
    await fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog');
    opener.focus();
    await tick();
    expect(dialog.contains(document.activeElement)).toBe(true);
  });

  it('closes on Escape and returns focus to the opener', async () => {
    render(SheetHarness);
    const opener = screen.getByRole('button', { name: 'Open settings' });
    opener.focus();
    await fireEvent.click(opener);
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await fireEvent.keyDown(document.activeElement, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(opener);
  });

  it('closes from the close button and locks page scroll while open', async () => {
    render(SheetHarness);
    const opener = screen.getByRole('button', { name: 'Open settings' });
    opener.focus();
    await fireEvent.click(opener);
    await screen.findByRole('dialog');
    expect(document.documentElement.style.overflow).toBe('hidden');
    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.activeElement).toBe(opener);
  });
});

describe('Toast', () => {
  afterEach(() => {
    get(toasts).forEach((t) => dismiss(t.id));
    vi.useRealTimers();
  });

  it('announces messages through a polite live region', async () => {
    render(ToastHarness);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    toast('Link copied');
    await tick();
    expect(region).toHaveTextContent('Link copied');
  });

  it('dismisses after four seconds', async () => {
    vi.useFakeTimers();
    render(ToastHarness);
    toast('Saved', { variant: 'success' });
    await tick();
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    vi.advanceTimersByTime(4000);
    await tick();
    expect(screen.getByRole('status')).not.toHaveTextContent('Saved');
  });

  it('can be dismissed by hand', async () => {
    render(ToastHarness);
    toast('Payment method removed');
    await tick();
    await fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.getByRole('status')).not.toHaveTextContent('Payment method removed');
  });
});

describe('Section', () => {
  it('carries its id, so #id links land on it, and names itself by its title', () => {
    const { container } = render(Section, { props: { id: 'cookies', title: 'Cookies' } });
    const section = container.querySelector('section');
    expect(section).toHaveAttribute('id', 'cookies');
    expect(section).toHaveAttribute('aria-labelledby', 'cookies-title');
    expect(screen.getByRole('heading', { level: 2, name: 'Cookies' })).toHaveAttribute('id', 'cookies-title');
  });
});

describe('Logo', () => {
  const box = (el) => [el.style.getPropertyValue('--w'), el.style.getPropertyValue('--h')];

  it('is a square box by default', () => {
    const { container } = render(Logo, { props: { src: '/brands/gcash.svg', alt: 'GCash' } });
    expect(box(container.querySelector('.logo'))).toEqual(['40px', '40px']);
    expect(screen.getByAltText('GCash')).toHaveAttribute('width', '40');
  });

  it.each([
    [40, '64px', '24px'],
    [32, '48px', '18px']
  ])('is a wide box for a wordmark at %i', (size, w, h) => {
    const { container } = render(Logo, { props: { src: '/brands/maya.svg', alt: 'Maya', size, wordmark: true } });
    expect(box(container.querySelector('.logo'))).toEqual([w, h]);
    const img = screen.getByAltText('Maya');
    expect(img).toHaveAttribute('width', w.replace('px', ''));
    expect(img).toHaveAttribute('height', h.replace('px', ''));
  });
});

describe('Row', () => {
  it('puts media after the leading slot, in a fixed-width box when mediaWidth is set', () => {
    const { container } = render(RowHarness, { props: { mediaWidth: 64 } });
    const rows = [...container.querySelectorAll('li.row')];
    expect(rows.map((r) => r.querySelector('.media').style.width)).toEqual(['64px', '64px', '64px']);
    const lead = rows[0].querySelector('.leading');
    expect(lead.firstElementChild).toHaveAttribute('data-handle');
    expect(lead.lastElementChild).toHaveClass('media');
  });

  it('lets the media size itself without mediaWidth', () => {
    const { container } = render(RowHarness);
    expect(container.querySelector('.media').style.width).toBe('');
  });

  it('can let the secondary line wrap instead of truncating', () => {
    const { container } = render(RowHarness, { props: { wrapSubtitle: true } });
    expect(container.querySelector('.subtitle')).toHaveClass('wrap');
    cleanup();
    const plain = render(RowHarness);
    expect(plain.container.querySelector('.subtitle')).not.toHaveClass('wrap');
  });
});
