<script>
	import { ThemeToggle } from '$lib/components';
</script>

<header class="fixed top-0 left-0 right-0 z-50">
	<nav class="p-4 rounded-b-3xl">
		<div class="px-8 mx-auto flex items-center justify-between">
			<div class="flex items-center space-x-3">				
				<div>
					<h1 class="text-xl font-bold" style="color: var(--apple-text);">iksi</h1>
					<p class="text-xs" style="color: var(--apple-text-secondary);">by andeus</p>
				</div>
			</div>
			
			<div class="flex items-center space-x-4">
				<ThemeToggle />
			</div>
		</div>
	</nav>
</header>
