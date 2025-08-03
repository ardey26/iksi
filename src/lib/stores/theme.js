import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// Get initial theme from localStorage or default to 'dark'
function getInitialTheme() {
	if (!browser) return 'dark';
	
	const savedTheme = localStorage.getItem('theme');
	if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark')) {
		return savedTheme;
	}
	
	// Check system preference
	if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
		return 'light';
	}
	
	return 'dark';
}

// Create the theme store
export const theme = writable(getInitialTheme());

// Theme toggle function
export function toggleTheme() {
	theme.update(currentTheme => {
		const newTheme = currentTheme === 'light' ? 'dark' : 'light';
		
		if (browser) {
			localStorage.setItem('theme', newTheme);
			document.documentElement.setAttribute('data-theme', newTheme);
		}
		
		return newTheme;
	});
}

// Initialize theme on page load
if (browser) {
	theme.subscribe(value => {
		document.documentElement.setAttribute('data-theme', value);
		localStorage.setItem('theme', value);
	});
	
	// Set initial theme
	const initialTheme = getInitialTheme();
	document.documentElement.setAttribute('data-theme', initialTheme);
}
