<script>
	export let user;

	let open = false;

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}

	function handleKeydown(event) {
		if (event.key === 'Escape') close();
	}

	$: initials = user?.name
		? user.name.charAt(0).toUpperCase()
		: user?.email
			? user.email.charAt(0).toUpperCase()
			: '?';
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div class="fixed inset-0 z-40" on:click={close}></div>
{/if}

<div class="relative">
	<button
		class="avatar-btn"
		on:click={toggle}
		aria-expanded={open}
		aria-haspopup="true"
		aria-label="User menu"
	>
		{#if user.avatarUrl}
			<img src={user.avatarUrl} alt="" class="avatar-img" referrerpolicy="no-referrer" />
		{:else}
			<span class="avatar-fallback">{initials}</span>
		{/if}
	</button>

	{#if open}
		<div class="dropdown-menu">
			<form method="POST" action="/auth/logout">
				<button type="submit" class="dropdown-item">
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" class="menu-icon">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
					</svg>
					Sign out
				</button>
			</form>
		</div>
	{/if}
</div>

<style>
	.avatar-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: var(--surface);
		cursor: pointer;
		padding: 0;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: border-color 0.15s ease;
	}

	.avatar-btn:hover {
		border-color: var(--accent);
	}

	.avatar-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.avatar-fallback {
		font-size: 0.8rem;
		font-weight: 600;
		color: var(--text-primary);
	}

	.dropdown-menu {
		position: absolute;
		right: 0;
		top: calc(100% + 8px);
		min-width: 160px;
		padding: 6px;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--border);
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
		z-index: 50;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 10px 14px;
		border-radius: 8px;
		color: var(--text-primary);
		background: none;
		border: none;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		font-family: inherit;
		transition: background 0.15s ease;
	}

	.dropdown-item:hover {
		background: var(--bg);
	}

	.menu-icon {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}
</style>
