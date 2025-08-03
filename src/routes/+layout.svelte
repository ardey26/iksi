<script>
	import '../app.css';
	import { Header, Footer } from '../lib/components';
	import { onMount } from 'svelte';
	import { theme } from '$lib/stores/theme.js';
	
	onMount(() => {
		// Initialize theme on mount
		if (typeof window !== 'undefined') {
			const savedTheme = localStorage.getItem('theme') || 'dark';
			document.documentElement.setAttribute('data-theme', savedTheme);
			theme.set(savedTheme);
		}
	});
</script>

<div class="min-h-screen flex flex-col" style="background: var(--apple-background);" lang="en">
	<Header />
	<main class="flex-1 flex items-center justify-center pt-16 pb-4 px-4 sm:px-6 lg:px-8" role="main">
		<slot />
	</main>
	<Footer />
</div>
