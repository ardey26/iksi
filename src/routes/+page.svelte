<script>
	import InvalidUrl from '../lib/components/toasts/InvalidURL.svelte';

	let longURL = '';
	let shortURL = '';
	let customURL = '';

	let error = '';
	let copied = false;

	const handleSubmit = async (e) => {
		const response = await fetch('/shorten', {
			method: 'POST',
			body: JSON.stringify({ longURL, customURL: customURL.trim() }),
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
		class="relative mt-1 mx-2 rounded-md shadow-sm flex h-screen justify-center items-center text-xl border-1 border-white"
	>
		<div class="lg:w-1/3 sm:w-3/4 max-w-screen-sm">
			<form on:submit|preventDefault={handleSubmit} class="form-control">
				<!-- svelte-ignore a11y-label-has-associated-control -->
				<div class="relative">
					<label class="label text-white text-3xl"> go ahead, shorten something... </label>
					<div class="row">
						<input
							type="text"
							name="longURL"
							id="longURL"
							placeholder="long url..."
							bind:value={longURL}
							class="pl-3 w-full h-[3rem] rounded-md border border-white border-gray-300 bg-neutral-900 text-white"
						/>
						<div class="absolute bottom-0 right-0">
							<button type="submit" class="btn btn-outline px-8 border text-white lowercase">
								enter
							</button>
						</div>
					</div>
				</div>
				<div class="form-group">
					<label class="label" for="customURL">
						<span class="label-text text-white text-2xl"> wanna make a custom one? </span>
						<input
							type="text"
							name="customURL"
							id="customURL"
							bind:value={customURL}
							maxlength="24"
							class="pl-3 w-2/5 h-[3rem] rounded-md border border-white border-gray-300 bg-neutral-900 text-white text-sm truncate"
							placeholder="optional custom link..."
						/>
					</label>
				</div>
			</form>

			{#if shortURL}
				<button
					class="w-full relative btn border border-white mt-3 py-3 bg-neutral-900 text-left normal-case"
					on:click={() => {
						navigator.clipboard.writeText(`iksi.com/${shortURL}`);
						copied = true;
					}}
				>
					<span class="absolute bottom-4 left-3">
						iksi.com/{shortURL}
					</span>

					<div class="absolute bottom-2 right-3">
						{#if copied}
							<button type="submit" class="btn btn-sm btn-success"> copied </button>
						{:else}
							<button type="submit" class="btn btn-sm btn-outline border text-white">
								click to copy
							</button>
						{/if}
					</div>
				</button>
			{/if}

			{#if error}
				<InvalidUrl {error} />
			{/if}
		</div>
	</div>
</div>
