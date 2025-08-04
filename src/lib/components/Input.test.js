import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Input from './Input.svelte';

describe('Input Component', () => {
	const defaultProps = {
		handleSubmit: vi.fn(),
		longURL: '',
		customURL: '',
		isLoading: false
	};

	it('should render form elements', () => {
		render(Input, { props: defaultProps });
		
		expect(screen.getByPlaceholderText('long-boring-url.com')).toBeInTheDocument();
		expect(screen.getByPlaceholderText('my-awesome-link')).toBeInTheDocument();
		expect(screen.getByText('Make it short!')).toBeInTheDocument();
	});

	it('should disable submit button when URL is empty', () => {
		render(Input, { props: defaultProps });
		const submitButton = screen.getByRole('button', { name: /create short link/i });
		
		expect(submitButton).toBeDisabled();
	});

	it('should enable submit button when valid URL is provided', () => {
		const props = { ...defaultProps, longURL: 'example.com' };
		render(Input, { props });
		const submitButton = screen.getByRole('button', { name: /create short link/i });
		
		expect(submitButton).not.toBeDisabled();
	});

	it('should show loading state during submission', () => {
		const props = { ...defaultProps, longURL: 'example.com', isLoading: true };
		render(Input, { props });
		
		expect(screen.getByText('Creating magic...')).toBeInTheDocument();
		expect(screen.getByLabelText('Creating short link...')).toBeInTheDocument();
	});

	it('should have proper accessibility attributes', () => {
		render(Input, { props: defaultProps });
		
		const urlInput = screen.getByPlaceholderText('long-boring-url.com');
		const aliasInput = screen.getByPlaceholderText('my-awesome-link');
		
		expect(urlInput).toHaveAttribute('type', 'text');
		expect(urlInput).toHaveAttribute('required');
		expect(aliasInput).toHaveAttribute('type', 'text');
		expect(aliasInput).toHaveAttribute('maxlength', '50');
	});

	it('should show validation error for invalid URL', () => {
		const props = { ...defaultProps, longURL: 'invalid-url' };
		render(Input, { props });
		
		expect(screen.getByText(/please enter a valid url/i)).toBeInTheDocument();
	});

	it('should show validation error for invalid alias', () => {
		const props = { ...defaultProps, longURL: 'example.com', customURL: 'invalid alias!' };
		render(Input, { props });
		
		expect(screen.getByText(/only letters, numbers, hyphens, and underscores allowed/i)).toBeInTheDocument();
	});

	it('should disable alias input when URL is invalid', () => {
		const props = { ...defaultProps, longURL: 'invalid' };
		render(Input, { props });
		
		const aliasInput = screen.getByPlaceholderText('my-awesome-link');
		expect(aliasInput).toBeDisabled();
	});

	it('should enable alias input when URL is valid', () => {
		const props = { ...defaultProps, longURL: 'example.com' };
		render(Input, { props });
		
		const aliasInput = screen.getByPlaceholderText('my-awesome-link');
		expect(aliasInput).not.toBeDisabled();
	});
});
