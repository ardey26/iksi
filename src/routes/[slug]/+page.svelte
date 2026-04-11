<script>
	export let data;

	function goBack() {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
		} else {
			window.location.href = '/';
		}
	}
</script>

<svelte:head>
	<title>Link to {data.domain} | iksi</title>
	<meta property="og:title" content="Link to {data.domain}" />
	<meta property="og:description" content={data.destinationURL} />
	<meta property="og:url" content="https://iksi.app/{data.slug}" />
	<meta property="og:type" content="website" />
	{#if data.isBot}
		<meta http-equiv="refresh" content="0; url={data.destinationURL}" />
	{/if}
</svelte:head>

{#if data.isBot}
	<noscript>
		<meta http-equiv="refresh" content="0; url={data.destinationURL}" />
	</noscript>
	<p>Redirecting to <a href={data.destinationURL}>{data.domain}</a>...</p>
{:else}
	<main class="preview-container">
		<div class="preview-card">
			<p class="preview-label">You're about to visit</p>
			<p class="preview-domain">{data.domain}</p>
			<p class="preview-url">{data.destinationURL}</p>

			{#if data.safeBrowsing === 'SAFE'}
				<div class="status status-safe">
					<span class="status-icon">✓</span>
					<span>Verified safe</span>
				</div>
			{:else if data.safeBrowsing === 'FLAGGED'}
				<div class="status status-flagged">
					<span class="status-icon">⚠</span>
					<span>This link has been flagged as potentially unsafe</span>
				</div>
			{:else}
				<div class="status status-unchecked">
					<span class="status-icon">○</span>
					<span>Not yet verified</span>
				</div>
			{/if}

			<div class="preview-actions">
				<a href={data.destinationURL} class="btn btn-primary">Continue</a>
				<button type="button" class="btn btn-secondary" on:click={goBack}>Go back</button>
			</div>

			<noscript>
				<form method="GET" action={data.destinationURL} style="display: inline;">
					<button type="submit" class="btn btn-primary">Continue (no JS)</button>
				</form>
			</noscript>
		</div>
	</main>
{/if}

<style>
	.preview-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1.5rem;
	}

	.preview-card {
		max-width: 480px;
		width: 100%;
		text-align: center;
	}

	.preview-label {
		font-size: 0.875rem;
		color: var(--text-muted);
		margin-bottom: 0.5rem;
	}

	.preview-domain {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 0.25rem;
	}

	.preview-url {
		font-size: 0.875rem;
		color: var(--text-muted);
		word-break: break-all;
		margin-bottom: 1.5rem;
	}

	.status {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		margin-bottom: 1.5rem;
	}

	.status-safe {
		background: rgba(34, 197, 94, 0.1);
		color: rgb(34, 197, 94);
	}

	.status-flagged {
		background: rgba(239, 68, 68, 0.1);
		color: rgb(239, 68, 68);
	}

	.status-unchecked {
		background: var(--surface);
		color: var(--text-muted);
	}

	.status-icon {
		font-size: 1rem;
	}

	.preview-actions {
		display: flex;
		gap: 0.75rem;
		justify-content: center;
	}

	.btn {
		padding: 0.75rem 1.5rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		text-decoration: none;
		border: none;
		transition: opacity 150ms ease;
	}

	.btn:hover {
		opacity: 0.9;
	}

	.btn-primary {
		background: var(--accent);
		color: white;
	}

	.btn-secondary {
		background: var(--surface);
		color: var(--text-primary);
	}
</style>
