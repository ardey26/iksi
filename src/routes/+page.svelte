<script>
	import InvalidUrl from '../lib/components/toasts/InvalidURL.svelte';
	let longURL = '';
	let shortURL = '';
	let error = '';

	const handleSubmit = async (e) => {
		const response = await fetch('/shorten', {
			method: 'POST',
			body: JSON.stringify({ longURL }),
			headers: {
				'content-type': 'application/json'
			}
		});
		const data = await response.json();

		shortURL = data.message;
		error = data.error;
		longURL = '';

		if (error) {
			await new Promise((res) => setTimeout(res, 3000));
			error = '';
		}
	};
</script>

<div>
	<div
		class="relative mt-1 rounded-md shadow-sm flex h-screen justify-center items-center text-xl border-1 border-white"
	>
		<div class="lg:w-1/2 sm:w-3/4">
			<form on:submit|preventDefault={handleSubmit} class="form-control relative">
				<!-- svelte-ignore a11y-label-has-associated-control -->
				<label class="label text-white text-3xl"> go ahead, shorten something... </label>
				<input
					type="text"
					name="longURL"
					id="longURL"
					bind:value={longURL}
					class="lg:w-3/4 sm:w-full h-[3rem] rounded-md border border-white border-gray-300 bg-neutral-900 text-white"
				/>
				<button type="submit" class="absolute bottom-0 right-0"
					><kbd class="kbd"> enter </kbd></button
				>
			</form>
			{#if shortURL}
				<h1 class="h1 block text-white text-3xl">{shortURL}</h1>
			{/if}

			{#if error}
				<InvalidUrl />
			{/if}
		</div>
	</div>
</div>
