<script>
	import { InvalidUrl, Input, ShortenedURL } from '../lib/components/';
	let longURL = '';
	let shortURL = '';
	let customURL = '';
	let isLoading = false;

	let error = '';
	let copied = false;

	const handleSubmit = async (e) => {
		isLoading = true;
		const response = await fetch('/api/shorten', {
			method: 'POST',
			body: JSON.stringify({ longURL: longURL.trim(), customURL: customURL.trim() }),
			headers: {
				'content-type': 'application/json'
			}
		});
		const data = await response.json();

		shortURL = data.shortURL;
		error = data.error;

		if (error) {
			await new Promise((res) => setTimeout(res, 3000));
			error = '';
		}

		isLoading = false;
	};
</script>

<div class="w-full max-w-md relative px-4">
	<!-- Ambient light effects -->
	<div class="absolute -top-20 -left-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl animate-pulse"></div>
	<div class="absolute -bottom-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style="animation-delay: 1s;"></div>
	
	<!-- Main card with liquid glass effect -->
	<div class="liquid-glass p-8 space-y-4 fade-in-up">		

		<Input bind:longURL bind:customURL bind:isLoading {handleSubmit} />

		<ShortenedURL {shortURL} bind:copied />

		{#if error}
			<InvalidUrl {error} />
		{/if}
	</div>
</div>
