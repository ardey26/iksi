import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import Input from './Input.svelte';

describe('Input Component', () => {
  const defaultProps = {
    handleSubmit: vi.fn(),
    longURL: '',
    customURL: '',
    isLoading: false,
    error: '',
    showCustomAlias: false
  };

  it('should render main input with placeholder', () => {
    render(Input, { props: defaultProps });

    expect(screen.getByPlaceholderText('Paste a link')).toBeInTheDocument();
  });

  it('should show submit button when valid URL is provided', () => {
    const props = { ...defaultProps, longURL: 'https://example.com' };
    render(Input, { props });

    expect(screen.getByLabelText('Shorten link')).toBeInTheDocument();
  });

  it('should show custom alias input when showCustomAlias is true', () => {
    const props = { ...defaultProps, showCustomAlias: true };
    render(Input, { props });

    expect(screen.getByPlaceholderText('your-name')).toBeInTheDocument();
  });

  it('should hide custom alias input when showCustomAlias is false', () => {
    render(Input, { props: defaultProps });

    // Alias input is only rendered when toggle is open
    expect(screen.queryByPlaceholderText('your-name')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Custom name' })).toBeInTheDocument();
  });

  it('should show loading spinner during submission', () => {
    const props = { ...defaultProps, longURL: 'https://example.com', isLoading: true };
    render(Input, { props });

    // Spinner is rendered inside the submit button during loading
    const spinner = document.querySelector('.spinner');
    expect(spinner).toBeInTheDocument();
  });

  it('should show error message when error prop is set', () => {
    const props = { ...defaultProps, error: 'Something went wrong' };
    render(Input, { props });

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    const props = { ...defaultProps, showCustomAlias: true };
    render(Input, { props });

    const urlInput = screen.getByPlaceholderText('Paste a link');
    const aliasInput = screen.getByPlaceholderText('your-name');

    expect(urlInput).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('URL to shorten')).toBe(urlInput);
    expect(aliasInput).toHaveAttribute('type', 'text');
    expect(aliasInput).toHaveAttribute('maxlength', '50');
    expect(screen.getByLabelText('Custom name')).toBe(aliasInput);
  });

  it('should not submit or offer to clear when input is empty', () => {
    render(Input, { props: defaultProps });

    expect(screen.getByLabelText('Shorten link')).toBeDisabled();
    expect(screen.queryByLabelText('Clear input')).not.toBeInTheDocument();
  });

  it('should show clear button when input has invalid content', () => {
    const props = { ...defaultProps, longURL: 'not-a-url' };
    render(Input, { props });

    expect(screen.getByLabelText('Clear input')).toBeInTheDocument();
  });

  it('marks an invalid link and does not submit it', async () => {
    const handleSubmit = vi.fn();
    render(Input, { props: { ...defaultProps, handleSubmit, longURL: 'not a url' } });
    expect(screen.getByLabelText('URL to shorten')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText("That doesn't look like a valid link")).toBeInTheDocument();
    await fireEvent.click(screen.getByLabelText('Shorten link'));
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it('submits a valid link', async () => {
    const handleSubmit = vi.fn();
    render(Input, { props: { ...defaultProps, handleSubmit, longURL: 'https://example.com' } });
    await fireEvent.click(screen.getByLabelText('Shorten link'));
    expect(handleSubmit).toHaveBeenCalled();
  });

  it('opens the custom name under the button row and keeps the toggle in place', async () => {
    const { container } = render(Input, { props: defaultProps });
    const toggle = screen.getByRole('button', { name: 'Custom name' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Custom name' })).toBe(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const url = screen.getByLabelText('URL to shorten');
    const alias = screen.getByPlaceholderText('your-name');
    const status = container.querySelector('#shorten-status');
    // URL field, message line, toggle, then the name: everything above the
    // name stays where it was.
    expect(url.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(status.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toggle.compareDocumentPosition(alias) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Tab reaches the name before Shorten.
    expect(alias.compareDocumentPosition(screen.getByLabelText('Shorten link')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('closes the custom name from the same toggle and drops the name', async () => {
    render(Input, { props: { ...defaultProps, showCustomAlias: true, customURL: 'sale' } });
    const toggle = screen.getByRole('button', { name: 'Custom name' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(screen.queryByPlaceholderText('your-name')).not.toBeInTheDocument());
  });

  it('keeps one message line in place whatever it says', async () => {
    const { container, rerender } = render(Input, { props: defaultProps });
    const status = container.querySelector('#shorten-status');
    expect(status).toBeEmptyDOMElement();
    await rerender({ error: 'Something went wrong' });
    expect(container.querySelector('#shorten-status')).toBe(status);
    await rerender({ error: '', suggestion: '@andre/sale', onSuggestion: () => {} });
    expect(container.querySelector('#shorten-status')).toBe(status);
    expect(status.querySelectorAll('p')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Use iksi.app/@andre/sale?' })).toBeInTheDocument();
  });
});
