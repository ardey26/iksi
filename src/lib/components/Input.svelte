<!-- svelte-ignore a11y-label-has-associated-control -->
<script>
	export let handleSubmit, longURL, customURL, isLoading;
</script>

<form on:submit|preventDefault={handleSubmit} class="form-control flex flex-col gap-1 bg-gradient-to-r from-neutral-700 via-neutral-750 to-neutral-800 backdrop-opacity-90 md:p-4 p-8 rounded-lg">
	<div class="relative">
		<label class="label text-white text-3xl"> go ahead, shorten something </label>
		<div class="row">
			<input
				type="text"
				name="longURL"
				id="longURL"
				placeholder="Paste your long URL here…"
				bind:value={longURL}
				class="pl-3 pr-[7rem] w-full h-[3rem] rounded-md border border-gray-300 bg-neutral-900 text-white text-base"
			/>
		</div>
	</div>
	<div class="form-group flex flex-col">
		<label class="label" for="customURL">
			<span class="label-text text-white text-lg mr-2"> wanna make a custom one? </span>
		</label>
		<input
			type="text"
			name="customURL"
			id="customURL"
			bind:value={customURL}
			disabled="{!longURL}"
			maxlength="24"
			class="p-2 w-full rounded-md border border-gray-300 bg-neutral-900 text-white truncate text-base"
			placeholder="Optional custom link..."
		/>
	</div>
	<div class="self-end mt-2">
		<button type="submit" class="btn btn-outline w-40 border-2 bg-green-800 font-bold text-white lowercase" disabled="{!longURL}">
			{#if isLoading}
				<svg class="animate-spin h-5 w-5 mr-3 border-t-2 border-b-2 border-white rounded-full" viewBox="0 0 24 24"></svg>
			{:else}
				<span>enter</span>
			{/if}
		</button>
	</div>
</form>
