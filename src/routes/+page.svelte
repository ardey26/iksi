<script>
	import { InvalidUrl, Input, ShortenedURL } from '../lib/components/';
	let longURL = '';
	let shortURL = '';
	let customURL = '';

	let error = '';
	let copied = false;

	const handleSubmit = async (e) => {
		const response = await fetch('/shorten', {
			method: 'POST',
			body: JSON.stringify({ longURL: longURL.trim(), customURL: customURL.trim() }),
			headers: {
				'content-type': 'application/json'
			}
		});
		const data = await response.json();

		shortURL = data.message;
		error = data.error;

		if (error) {
			await new Promise((res) => setTimeout(res, 3000));
			error = '';
		}
	};
</script>

<div>
	<div class="relative mt-1 mx-2 rounded-md flex h-[93.5vh] justify-center items-center text-xl">
		<div class="lg:w-1/3 sm:w-3/4 max-w-screen-sm relative">
			<Input bind:longURL bind:customURL {handleSubmit} />

			<ShortenedURL {shortURL} bind:copied />

			{#if error}
				<InvalidUrl {error} />
			{/if}
		</div>
	</div>
</div>
