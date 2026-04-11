import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
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

    expect(screen.getByText('Shorten')).toBeInTheDocument();
  });

  it('should show custom alias input when showCustomAlias is true', () => {
    const props = { ...defaultProps, showCustomAlias: true };
    render(Input, { props });

    expect(screen.getByPlaceholderText('your-alias')).toBeInTheDocument();
  });

  it('should hide custom alias input when showCustomAlias is false', () => {
    render(Input, { props: defaultProps });

    // The alias input exists but is in a hidden container (height: 0)
    const aliasSection = screen.getByPlaceholderText('your-alias').closest('div[class*="overflow-hidden"]');
    expect(aliasSection).toHaveStyle({ height: '0' });
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
    const aliasInput = screen.getByPlaceholderText('your-alias');

    expect(urlInput).toHaveAttribute('type', 'text');
    expect(urlInput).toHaveAttribute('aria-label', 'URL to shorten');
    expect(aliasInput).toHaveAttribute('type', 'text');
    expect(aliasInput).toHaveAttribute('maxlength', '50');
    expect(aliasInput).toHaveAttribute('aria-label', 'Custom alias');
  });

  it('should show paste button when input is empty', () => {
    render(Input, { props: defaultProps });

    expect(screen.getByLabelText('Paste from clipboard')).toBeInTheDocument();
  });

  it('should show clear button when input has content', () => {
    const props = { ...defaultProps, longURL: 'https://example.com' };
    render(Input, { props });

    expect(screen.getByLabelText('Clear input')).toBeInTheDocument();
  });
});
