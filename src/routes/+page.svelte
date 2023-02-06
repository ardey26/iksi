<script>
	import InvalidUrl from '../lib/components/toasts/InvalidURL.svelte';
	let longURL = '';
	let shortURL = '';
	let error = '';

	let copied = false;

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
				<div class="row">
					<input
						type="text"
						name="longURL"
						id="longURL"
						bind:value={longURL}
						class="pl-3 w-full h-[3rem] rounded-md border border-white border-gray-300 bg-neutral-900 text-white"
					/>
					<div class="absolute bottom-0 right-0">
						<button type="submit" class="btn btn-ghost">
							<kbd class="kbd kbd-md">return</kbd>
						</button>
					</div>
				</div>
			</form>
			{#if shortURL}
				<button
					class="w-full relative btn border border-white mt-3 py-3"
					on:click={() => {
						navigator.clipboard.writeText(`iksi.com/${shortURL}`);
						copied = true;
					}}
				>
					<div class="card bg-base-300 rounded-box">
						iksi.com/{shortURL}
					</div>
					<div class="absolute bottom-2 right-3">
						{#if copied}
							<button type="submit" class="btn btn-sm btn-success"> copied </button>
						{:else}
							<button type="submit" class="btn btn-sm btn-outline"> click to copy </button>
						{/if}
					</div>
				</button>
			{/if}

			{#if error}
				<InvalidUrl />
			{/if}
		</div>
	</div>
</div>
