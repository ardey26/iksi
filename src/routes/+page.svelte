<script>
	// import { shortenURL } from '../stores/urlStore.js';

	let longURL = '';

	const handleSubmit = () => {
		// shortenURL(longURL);
		console.log(longURL);
		longURL = '';
	};
</script>

<div>
	<div
		class="relative mt-1 rounded-md shadow-sm flex h-screen justify-center items-center text-xl border-1 border-white"
	>
		<div class="w-2/5">
			<h1 class="h1 block text-white mb-3 text-3xl">go ahead, shorten something...</h1>
			<form on:submit|preventDefault={handleSubmit}>
				<input
					type="text"
					name="longURL"
					id="longURL"
					bind:value={longURL}
					class="block w-full h-[3rem] rounded-md border-gray-300 bg-neutral-900 text-white pl-7 pr-12 focus:border-indigo-500 focus:ring-indigo-500"
				/>
			</form>
		</div>
	</div>
</div>
