<script>
	import { fade } from 'svelte/transition';

	export let error;
</script>

<div class="fixed top-4 right-4 z-50" transition:fade={{ duration: 300 }}>
	<div class="glass rounded-2xl p-4 backdrop-blur-xl shadow-lg" 
		 style="border: 1px solid var(--apple-red); background: linear-gradient(135deg, rgba(255, 255, 255, 0.25), rgba(255, 255, 255, 0.15)), rgba(255, 59, 48, 0.2); backdrop-filter: blur(20px);">
		<div class="flex items-center space-x-3">
			<div class="flex-shrink-0">
				<svg class="w-5 h-5" style="color: var(--apple-red);" fill="currentColor" viewBox="0 0 20 20">
					<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
				</svg>
			</div>
			<div>
				<p class="font-medium text-sm" style="color: var(--apple-red);">{error}</p>
			</div>
		</div>
	</div>
</div>
