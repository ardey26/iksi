<script>
	import { copyToClipboard } from '../utils/clipboard.js';
	
	export let shortURL, copied;
	
	const copyURL = async () => {
		const fullURL = `${location.protocol}//${location.host}/${shortURL}`;
		const success = await copyToClipboard(fullURL);
		
		if (success) {
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} else {
			// Show error feedback if copy fails
			console.error('Failed to copy URL');
		}
	};
</script>

{#if shortURL}
	<div class="space-y-2 fade-in-up mt-2">
		<div class="text-center">
			<p class="text-xs mb-1" style="color: var(--apple-text-secondary);">✨ boom! here's your shiny new link ✨</p>
		</div>
		
		<div class="glass rounded-2xl p-3 space-y-3">
			<div class="flex items-center justify-between">
				<div class="flex-1 min-w-0">					
					<p class="font-mono text-sm truncate" style="color: var(--apple-text);">
						{location.hostname.replace("www.", "")}/{shortURL}
					</p>
				</div>
				
				<button
					on:click={copyURL}
					class="ml-4 flex items-center space-x-2 px-4 py-2 rounded-xl transition-all duration-200 {copied 
						? 'text-green-400' 
						: 'hover:bg-opacity-80'
					}"
					style="background: var(--apple-surface-secondary); border: 1px solid var(--apple-border); color: var(--apple-text);"
				>
					{#if copied}
						<svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
							<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
						</svg>
						<span class="text-sm font-medium">snatched!</span>
					{:else}
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
						</svg>
						<span class="text-sm font-medium">snatch it</span>
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}
