<script>
	import '../../app.css';
	import { Header } from '$lib/components';
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

<svelte:head>
	<title>{data.profileUser.name || `@${data.profileUser.username}`} | iksi</title>
</svelte:head>

<div class="min-h-screen flex flex-col overflow-clip" style="background: var(--bg);">
	<Header user={data.currentUser} />
	<main class="flex-1 flex flex-col pt-16 pb-4">
		<slot />
	</main>
</div>
