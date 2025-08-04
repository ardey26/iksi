<script>
	import { InvalidUrl, Input, ShortenedURL } from '../lib/components/';
	import { onMount } from 'svelte';
	
	let longURL = '';
	let shortURL = '';
	let customURL = '';
	let isLoading = false;
	let error = '';
	let copied = false;
	let mounted = false;

	onMount(() => {
		mounted = true;
	});

	const handleSubmit = async (e) => {
		if (isLoading) return; // Prevent double submissions
		
		isLoading = true;
		error = '';
		shortURL = ''; // Clear previous result
		
		try {
			const response = await fetch('/api/shorten', {
				method: 'POST',
				body: JSON.stringify({ longURL: longURL.trim(), customURL: customURL.trim() }),
				headers: {
					'content-type': 'application/json'
				}
			});
			
			const data = await response.json();

			if (response.ok) {
				shortURL = data.shortURL;
				// Clear form on success
				longURL = '';
				customURL = '';
			} else {
				error = data.error || 'Something went wrong';
				// Auto-clear error after 5 seconds
				setTimeout(() => {
					error = '';
				}, 5000);
			}
		} catch (err) {
			console.error('Network error:', err);
			error = 'Network error. Please check your connection and try again.';
			setTimeout(() => {
				error = '';
			}, 5000);
		} finally {
			isLoading = false;
		}
	};
</script>

<div class="w-full max-w-md relative px-4 overflow-clip" class:opacity-0={!mounted} class:fade-in-up={mounted}>
	<!-- Ambient light effects -->
	<div class="absolute -top-20 -left-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
	<div class="absolute -bottom-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style="animation-delay: 1s;"></div>
	
	<!-- Main card with liquid glass effect -->
	<div class="liquid-glass p-8 space-y-4">		

		<Input bind:longURL bind:customURL bind:isLoading {handleSubmit} />

		{#if shortURL}
			<ShortenedURL {shortURL} bind:copied />
		{/if}

		{#if error}
			<InvalidUrl {error} />
		{/if}
	</div>
</div>
