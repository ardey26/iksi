<script>
	import { isValidURL, isValidAlias } from '../utils/validation.js';
	
	export let handleSubmit, longURL, customURL, isLoading;
	
	$: isURLValid = longURL ? isValidURL(longURL) : true;
	$: isAliasValid = customURL ? isValidAlias(customURL) : true;
	$: canSubmit = longURL && isURLValid && isAliasValid && !isLoading;
	const handleKeyDown = (e) => {
		// Submit on Ctrl/Cmd + Enter
		if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canSubmit) {
			handleSubmit(e);
		}
	};
</script>

<form 
	on:submit|preventDefault={handleSubmit} 
	on:keydown={handleKeyDown}
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
				class="apple-input w-full {!isURLValid && longURL ? 'border-red-500' : ''}"
				required
				aria-describedby="longURL-help"
				aria-label="Enter the long URL you want to shorten"
			/>
			{#if !isURLValid && longURL}
				<p class="text-red-500 text-xs mt-1">Please enter a valid URL</p>
			{/if}
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
					maxlength="50"
					class="apple-input w-full {!isAliasValid && customURL ? 'border-red-500' : ''}"
					placeholder="my-awesome-link"
					aria-describedby="customURL-help"
					aria-label="Optional custom short link name"
				/>
				{#if !isAliasValid && customURL}
					<p class="text-red-500 text-xs mt-1">Only letters, numbers, hyphens, and underscores allowed (max 50 chars)</p>
				{/if}
				<div id="customURL-help" class="sr-only">
					Optional: Create a custom name for your short link (letters, numbers, and hyphens only)
				</div>
			
		</div>
	</fieldset>

	<button 
		type="submit" 
		class="apple-button w-full" 
		disabled={!canSubmit}
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
