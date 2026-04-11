<script>
	import { ThemeToggle } from '$lib/components';
	import AuthDropdown from './AuthDropdown.svelte';
	import UserMenu from './UserMenu.svelte';

	export let user = null;
</script>

<header class="fixed top-0 left-0 right-0 z-50" style="background: var(--bg);">
	<nav class="p-4">
		<div class="px-6 mx-auto flex items-center justify-between">
			<!-- Brand mark -->
			<div class="flex items-center gap-2">
				<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" style="color: var(--text-muted);">
					<circle cx="12" cy="12" r="11" fill="currentColor" />
					<g transform="rotate(-45 12 12)" stroke="var(--bg)" stroke-width="1.5" fill="none">
						<rect x="4" y="10" width="7" height="4" rx="2" />
						<rect x="13" y="10" width="7" height="4" rx="2" />
					</g>
				</svg>
				<span class="text-sm font-medium tracking-tight" style="color: var(--text-muted);">iksi</span>
			</div>

			<!-- Right side controls -->
			<div class="flex items-center gap-3">
				<ThemeToggle />
				{#if user}
					<UserMenu {user} />
				{:else}
					<AuthDropdown />
				{/if}
			</div>
		</div>
	</nav>
</header>
