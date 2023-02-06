<!-- svelte-ignore a11y-label-has-associated-control -->
<script>
	export let handleSubmit, longURL, customURL;
</script>

<form on:submit|preventDefault={handleSubmit} class="form-control">
	<div class="relative">
		<label class="label text-white text-3xl"> go ahead, shorten something... </label>
		<div class="row">
			<input
				type="text"
				name="longURL"
				id="longURL"
				placeholder="long url..."
				bind:value={longURL}
				class="pl-3 pr-[7rem] w-full h-[3rem] rounded-md border border-white border-gray-300 bg-neutral-900 text-white"
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
			<span class="label-text text-white text-lg md:text-2xl mr-2"> wanna make a custom one? </span>
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
