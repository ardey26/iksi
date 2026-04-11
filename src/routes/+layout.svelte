<script>
	import '../app.css';
	import { Header } from '../lib/components';
	import { onMount } from 'svelte';
	import { theme } from '$lib/stores/theme.js';

	export let data;

	onMount(() => {
		// Initialize theme on mount
		if (typeof window !== 'undefined') {
			const savedTheme = localStorage.getItem('theme') || 'dark';
			document.documentElement.setAttribute('data-theme', savedTheme);
			theme.set(savedTheme);
		}
	});
</script>

<div class="min-h-screen flex flex-col overflow-clip" style="background: var(--bg);">
	<Header user={data.user} />
	<main class="flex-1 flex items-center justify-center pt-16 pb-4">
		<slot />
	</main>
</div>
