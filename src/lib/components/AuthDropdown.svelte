<script>
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
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<div class="fixed inset-0 z-40" on:click={close}></div>
{/if}

<div class="relative">
	<button
		class="sign-in-btn"
		on:click={toggle}
		aria-expanded={open}
		aria-haspopup="true"
	>
		Sign in
	</button>

	{#if open}
		<div class="dropdown-menu">
			<a href="/auth/login/google" class="dropdown-item" on:click={close}>
				<svg viewBox="0 0 24 24" class="provider-icon">
					<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
					<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
					<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
					<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
				</svg>
				Continue with Google
			</a>
			<a href="/auth/login/twitter" class="dropdown-item" on:click={close}>
				<svg viewBox="0 0 24 24" class="provider-icon">
					<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="currentColor"/>
				</svg>
				Continue with X
			</a>
		</div>
	{/if}
</div>

<style>
	.sign-in-btn {
		height: 36px;
		padding: 0 16px;
		font-size: 0.875rem;
		font-weight: 500;
		border-radius: 18px;
		background: var(--surface);
		border: 1px solid var(--border);
		color: var(--text-primary);
		cursor: pointer;
		transition: border-color 0.15s ease;
	}

	.sign-in-btn:hover {
		border-color: var(--accent);
	}

	.dropdown-menu {
		position: absolute;
		right: 0;
		top: calc(100% + 8px);
		min-width: 220px;
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
		padding: 10px 14px;
		border-radius: 8px;
		color: var(--text-primary);
		text-decoration: none;
		font-size: 0.875rem;
		font-weight: 500;
		transition: background 0.15s ease;
	}

	.dropdown-item:hover {
		background: var(--bg);
	}

	.provider-icon {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
	}
</style>
