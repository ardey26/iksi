<script>
	export let handleSubmit, longURL, customURL, isLoading;
</script>

<form 
	on:submit|preventDefault={handleSubmit} 
	class="space-y-4"
	aria-label="URL Shortening Form"
	role="form"
>
	<fieldset class="space-y-3 sm:space-y-4" aria-label="URL Input Fields">
		<div class="space-y-1 sm:space-y-2">
			<label for="longURL" class="block text-lg sm:text-xl md:text-2xl font-medium" style="color: var(--apple-text);">
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
				aria-describedby="longURL-help"
				aria-label="Enter the long URL you want to shorten"
			/>
			<div id="longURL-help" class="sr-only">
				Enter a valid URL starting with http:// or https:// that you want to make shorter
			</div>
		</div>

		<div class="space-y-1 sm:space-y-2">
			<label for="customURL" class="block text-sm sm:text-base font-medium" style="color: var(--apple-text);">
				wanna make a custom one? <span style="color: var(--apple-text-secondary);">(totally optional)</span>
			</label>
							
				<input
					type="text"
					name="customURL"
					id="customURL"
					bind:value={customURL}
					disabled={!longURL}
					maxlength="24"
					class="apple-input w-full"
					placeholder="my-awesome-link"
					aria-describedby="customURL-help"
					aria-label="Optional custom short link name"
				/>
				<div id="customURL-help" class="sr-only">
					Optional: Create a custom name for your short link (letters, numbers, and hyphens only)
				</div>
			
		</div>
	</fieldset>

	<button 
		type="submit" 
		class="apple-button w-full" 
		disabled={!longURL || isLoading}
		aria-label={isLoading ? 'Creating short link...' : 'Create short link'}
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
