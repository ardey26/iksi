<!-- svelte-ignore a11y-missing-attribute -->
<script>
	import FaGithubSquare from 'svelte-icons/fa/FaGithubSquare.svelte';
	import FaGooglePlusSquare from 'svelte-icons/fa/FaGooglePlusSquare.svelte';
</script>

<footer class="mt-8" style="border-top: 1px solid var(--apple-border);">
	<div class="mx-auto px-8 py-4">
		<div class="flex flex-col md:flex-row justify-between items-center space-y-2 md:space-y-0">
			<div class="text-center md:text-left">
				<p class="text-xs" style="color: var(--apple-text-secondary);">
					© {new Date().getFullYear()} iksi. All rights reserved.
				</p>
			</div>
			
			
			<div class="flex items-center space-x-3">
				<a 
					href="http://www.github.com/ardey26/iksi.git" 
					target="_blank" 
					rel="noreferrer"
					class="p-1.5 rounded-lg"
					style="background: var(--apple-surface-secondary); border: 1px solid var(--apple-border); color: var(--apple-text-secondary);"
					title="View source on GitHub"
				>
					<div class="w-4 h-4">
						<FaGithubSquare />
					</div>
				</a>
				
				<a 
					href="mailto:dejesusandre0226@gmail.com" 
					target="_blank"
					class="p-1.5 rounded-lg"
					style="background: var(--apple-surface-secondary); border: 1px solid var(--apple-border); color: var(--apple-text-secondary);"
					title="Send an email"
				>
					<div class="w-4 h-4">
						<FaGooglePlusSquare />
					</div>
				</a>
			</div>
		</div>
	</div>
</footer>
