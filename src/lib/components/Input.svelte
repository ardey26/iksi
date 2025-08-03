<!-- svelte-ignore a11y-label-has-associated-control -->
<script>
	export let handleSubmit, longURL, customURL, isLoading;
</script>

<form on:submit|preventDefault={handleSubmit} class="space-y-4">
	<div class="space-y-3">
		<div class="space-y-1">
			<label for="longURL" class="block text-2xl font-medium" style="color: var(--apple-text);">
				go ahead, shorten something...
			</label>
			<input
				type="url"
				name="longURL"
				id="longURL"
				placeholder="https://long-boring-url.com"
				bind:value={longURL}
				class="apple-input w-full"
				required
			/>
		</div>

		<div class="space-y-1">
			<label for="customURL" class="block text-md font-medium" style="color: var(--apple-text);">
				wanna make a custom one? <span style="color: var(--apple-text-secondary);">(totally optional)</span>
			</label>
			<div class="relative">				
				<input
					type="text"
					name="customURL"
					id="customURL"
					bind:value={customURL}
					disabled={!longURL}
					maxlength="24"
					class="apple-input w-full pl-32"
					placeholder="my-awesome-link"
				/>
			</div>
		</div>
	</div>

	<button 
		type="submit" 
		class="apple-button w-full" 
		disabled={!longURL || isLoading}
	>
		{#if isLoading}
			<div class="flex items-center justify-center space-x-2">
				<div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
				<span>Creating magic...</span>
			</div>
		{:else}
			<span>Make it short!</span>
		{/if}
	</button>
</form>
