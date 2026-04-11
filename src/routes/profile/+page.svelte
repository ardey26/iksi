<script>
	import { Input, ShortenedURL } from '$lib/components/';
	import { copyToClipboard } from '$lib/utils/clipboard.js';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';

	export let data;

	// Shortener state (owner only)
	let longURL = '';
	let customURL = '';
	let shortURL = '';
	let isLoading = false;
	let error = '';
	let showCustomAlias = false;
	let inputRef;

	// Track copied state per link
	let copiedSlug = null;

	// Delete confirmation
	let deletingSlug = null;

	onMount(() => {
		if (data.isOwner && inputRef) {
			inputRef.focus();
		}
	});

	const handleSubmit = async () => {
		if (isLoading) return;

		isLoading = true;
		error = '';

		try {
			const response = await fetch('/api/shorten', {
				method: 'POST',
				body: JSON.stringify({ longURL: longURL.trim(), customURL: customURL.trim() }),
				headers: { 'content-type': 'application/json' }
			});

			const result = await response.json();

			if (response.ok) {
				shortURL = result.shortURL;
			} else {
				error = result.error || 'Something went wrong';
				setTimeout(() => { error = ''; }, 4000);
				isLoading = false;
			}
		} catch (err) {
			error = 'Network error. Please try again.';
			setTimeout(() => { error = ''; }, 4000);
			isLoading = false;
		}
	};

	const reset = async () => {
		shortURL = '';
		longURL = '';
		customURL = '';
		showCustomAlias = false;
		error = '';
		isLoading = false;
		// Refresh links list
		await invalidateAll();
		setTimeout(() => {
			if (inputRef) inputRef.focus();
		}, 50);
	};

	const handleKeydown = (e) => {
		if (e.key === 'Escape') {
			if (shortURL) {
				reset();
			} else {
				longURL = '';
				customURL = '';
				error = '';
			}
		}
	};

	const copyShortURL = async (slug) => {
		const fullURL = typeof window !== 'undefined'
			? `${location.protocol}//${location.host}/${slug}`
			: slug;
		const success = await copyToClipboard(fullURL);
		if (success) {
			copiedSlug = slug;
			setTimeout(() => { copiedSlug = null; }, 1500);
		}
	};

	const toggleListed = async (slug, currentValue) => {
		try {
			const response = await fetch(`/api/links/${slug}`, {
				method: 'PATCH',
				body: JSON.stringify({ listed: !currentValue }),
				headers: { 'content-type': 'application/json' }
			});

			if (response.ok) {
				await invalidateAll();
			}
		} catch (err) {
			console.error('Failed to update listed status');
		}
	};

	const togglePreview = async (slug, currentValue) => {
		try {
			const response = await fetch(`/api/links/${slug}`, {
				method: 'PATCH',
				body: JSON.stringify({ showPreview: !currentValue }),
				headers: { 'content-type': 'application/json' }
			});

			if (response.ok) {
				await invalidateAll();
			}
		} catch (err) {
			console.error('Failed to update preview status');
		}
	};

	const deleteLink = async (slug) => {
		try {
			const response = await fetch(`/api/links/${slug}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				deletingSlug = null;
				await invalidateAll();
			}
		} catch (err) {
			console.error('Failed to delete link');
		}
	};

	const formatDate = (isoString) => {
		const date = new Date(isoString);
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	};

	const truncateURL = (url, maxLength = 40) => {
		if (url.length <= maxLength) return url;
		return url.slice(0, maxLength - 3) + '...';
	};
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="profile-container">
	{#if data.isOwner}
		<!-- Owner View: Dashboard -->
		<div class="dashboard">
			<!-- Shortener section -->
			<section class="shortener-section">
				<div class="shortener-wrapper">
					{#if shortURL}
						<ShortenedURL {shortURL} on:reset={reset} />
					{:else}
						<Input
							bind:longURL
							bind:customURL
							bind:showCustomAlias
							bind:inputRef
							{isLoading}
							{error}
							{handleSubmit}
						/>
					{/if}
				</div>
			</section>

			<!-- Links table -->
			<section class="links-section">
				{#if data.links.length === 0}
					<div class="empty-state">
						<p class="empty-title">No links yet</p>
						<p class="empty-subtitle">Create your first short link above</p>
					</div>
				{:else}
					<div class="links-table-wrapper">
						<table class="links-table">
							<thead>
								<tr>
									<th>Slug</th>
									<th>Destination</th>
									<th>Clicks</th>
									<th>Listed</th>
									<th>Preview</th>
									<th>Created</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{#each data.links as link}
									<tr>
										<td class="slug-cell">
											<button
												class="slug-btn"
												on:click={() => copyShortURL(link.slug)}
												title="Click to copy"
											>
												{link.slug}
												{#if copiedSlug === link.slug}
													<span class="copied-badge">Copied</span>
												{/if}
											</button>
										</td>
										<td class="destination-cell" title={link.destinationURL}>
											<a href={link.destinationURL} target="_blank" rel="noopener noreferrer">
												{truncateURL(link.destinationURL)}
											</a>
										</td>
										<td class="clicks-cell">
											<span class="clicks-count">{link.clicks.total}</span>
											{#if link.clicks.total > 0}
												<span class="organic-pct">({link.clicks.organicPercent}% organic)</span>
											{/if}
										</td>
										<td class="toggle-cell">
											<button
												class="toggle-btn"
												class:active={link.listed}
												on:click={() => toggleListed(link.slug, link.listed)}
												title={link.listed ? 'Hide from profile' : 'Show on profile'}
											>
												{link.listed ? 'On' : 'Off'}
											</button>
										</td>
										<td class="toggle-cell">
											<button
												class="toggle-btn"
												class:active={link.showPreview}
												on:click={() => togglePreview(link.slug, link.showPreview)}
												title={link.showPreview ? 'Disable preview page' : 'Enable preview page'}
											>
												{link.showPreview ? 'On' : 'Off'}
											</button>
										</td>
										<td class="date-cell">{formatDate(link.createdAt)}</td>
										<td class="actions-cell">
											{#if deletingSlug === link.slug}
												<div class="confirm-delete">
													<button class="confirm-btn" on:click={() => deleteLink(link.slug)}>Delete</button>
													<button class="cancel-btn" on:click={() => deletingSlug = null}>Cancel</button>
												</div>
											{:else}
												<button
													class="delete-btn"
													on:click={() => deletingSlug = link.slug}
													title="Delete link"
												>
													<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
														<path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
													</svg>
												</button>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Pagination -->
					{#if data.pagination.totalPages > 1}
						<nav class="pagination">
							{#if data.pagination.page > 1}
								<a href="?page={data.pagination.page - 1}" class="page-btn">Previous</a>
							{/if}
							<span class="page-info">
								Page {data.pagination.page} of {data.pagination.totalPages}
							</span>
							{#if data.pagination.page < data.pagination.totalPages}
								<a href="?page={data.pagination.page + 1}" class="page-btn">Next</a>
							{/if}
						</nav>
					{/if}
				{/if}
			</section>
		</div>
	{:else}
		<!-- Public View: Profile -->
		<div class="public-profile">
			<header class="profile-header">
				{#if data.profileUser.avatarUrl}
					<img
						src={data.profileUser.avatarUrl}
						alt={data.profileUser.name || data.profileUser.username}
						class="profile-avatar"
					/>
				{/if}
				<h1 class="profile-name">
					{data.profileUser.name || `@${data.profileUser.username}`}
				</h1>
				{#if data.profileUser.name}
					<p class="profile-username">@{data.profileUser.username}</p>
				{/if}
			</header>

			{#if data.links.length === 0}
				<div class="empty-state">
					<p class="empty-subtitle">No public links</p>
				</div>
			{:else}
				<ul class="public-links">
					{#each data.links as link}
						<li>
							<a
								href="/{link.slug}"
								class="public-link"
								target="_blank"
								rel="noopener noreferrer"
							>
								<span class="link-slug">/{link.slug}</span>
								<span class="link-dest">{truncateURL(link.destinationURL, 50)}</span>
							</a>
						</li>
					{/each}
				</ul>

				<!-- Pagination for public view -->
				{#if data.pagination.totalPages > 1}
					<nav class="pagination">
						{#if data.pagination.page > 1}
							<a href="?page={data.pagination.page - 1}" class="page-btn">Previous</a>
						{/if}
						<span class="page-info">
							Page {data.pagination.page} of {data.pagination.totalPages}
						</span>
						{#if data.pagination.page < data.pagination.totalPages}
							<a href="?page={data.pagination.page + 1}" class="page-btn">Next</a>
						{/if}
					</nav>
				{/if}
			{/if}
		</div>
	{/if}
</div>

<style>
	.profile-container {
		width: 100%;
		max-width: 1000px;
		margin: 0 auto;
		padding: 0 24px;
	}

	/* Dashboard (Owner View) */
	.dashboard {
		display: flex;
		flex-direction: column;
		gap: 48px;
		padding-top: 32px;
	}

	.shortener-section {
		display: flex;
		justify-content: center;
	}

	.shortener-wrapper {
		width: 100%;
		max-width: 500px;
	}

	.links-section {
		width: 100%;
	}

	/* Empty state */
	.empty-state {
		text-align: center;
		padding: 48px 24px;
	}

	.empty-title {
		font-size: 18px;
		font-weight: 500;
		color: var(--text-primary);
		margin-bottom: 8px;
	}

	.empty-subtitle {
		font-size: 14px;
		color: var(--text-muted);
	}

	/* Links table */
	.links-table-wrapper {
		overflow-x: auto;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--border);
	}

	.links-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 14px;
	}

	.links-table th {
		text-align: left;
		padding: 12px 16px;
		font-weight: 500;
		color: var(--text-muted);
		border-bottom: 1px solid var(--border);
		white-space: nowrap;
	}

	.links-table td {
		padding: 12px 16px;
		border-bottom: 1px solid var(--border);
		color: var(--text-primary);
	}

	.links-table tr:last-child td {
		border-bottom: none;
	}

	.links-table tr:hover td {
		background: var(--bg);
	}

	.slug-cell {
		font-family: monospace;
	}

	.slug-btn {
		background: none;
		border: none;
		color: var(--accent);
		cursor: pointer;
		font-family: monospace;
		font-size: 14px;
		padding: 4px 8px;
		margin: -4px -8px;
		border-radius: 4px;
		display: inline-flex;
		align-items: center;
		gap: 8px;
	}

	.slug-btn:hover {
		background: color-mix(in srgb, var(--accent) 10%, transparent);
	}

	.copied-badge {
		font-size: 11px;
		font-family: inherit;
		color: var(--text-muted);
		background: var(--bg);
		padding: 2px 6px;
		border-radius: 4px;
	}

	.destination-cell a {
		color: var(--text-muted);
		text-decoration: none;
	}

	.destination-cell a:hover {
		color: var(--text-primary);
		text-decoration: underline;
	}

	.clicks-cell {
		white-space: nowrap;
	}

	.clicks-count {
		font-weight: 500;
	}

	.organic-pct {
		color: var(--text-muted);
		font-size: 12px;
		margin-left: 4px;
	}

	.toggle-cell {
		text-align: center;
	}

	.toggle-btn {
		padding: 4px 10px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: 500;
		border: 1px solid var(--border);
		background: transparent;
		color: var(--text-muted);
		cursor: pointer;
		transition: all var(--duration-normal) var(--ease-out);
	}

	.toggle-btn.active {
		background: var(--accent);
		color: white;
		border-color: var(--accent);
	}

	.toggle-btn:hover:not(.active) {
		border-color: var(--text-muted);
	}

	.date-cell {
		color: var(--text-muted);
		white-space: nowrap;
	}

	.actions-cell {
		text-align: right;
	}

	.delete-btn {
		padding: 6px;
		border-radius: 6px;
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}

	.delete-btn:hover {
		color: var(--error);
		background: color-mix(in srgb, var(--error) 10%, transparent);
	}

	.confirm-delete {
		display: flex;
		gap: 8px;
	}

	.confirm-btn {
		padding: 4px 10px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
		background: var(--error);
		color: white;
		border: none;
		cursor: pointer;
	}

	.cancel-btn {
		padding: 4px 10px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 500;
		background: none;
		border: 1px solid var(--border);
		color: var(--text-muted);
		cursor: pointer;
	}

	.cancel-btn:hover {
		border-color: var(--text-muted);
	}

	/* Pagination */
	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 16px;
		padding: 24px 0;
	}

	.page-btn {
		padding: 8px 16px;
		border-radius: 8px;
		font-size: 14px;
		font-weight: 500;
		background: var(--surface);
		border: 1px solid var(--border);
		color: var(--text-primary);
		text-decoration: none;
		transition: all var(--duration-normal) var(--ease-out);
	}

	.page-btn:hover {
		border-color: var(--accent);
		color: var(--accent);
	}

	.page-info {
		font-size: 14px;
		color: var(--text-muted);
	}

	/* Public Profile View */
	.public-profile {
		max-width: 500px;
		margin: 0 auto;
		padding-top: 48px;
	}

	.profile-header {
		text-align: center;
		margin-bottom: 40px;
	}

	.profile-avatar {
		width: 80px;
		height: 80px;
		border-radius: 50%;
		margin-bottom: 16px;
		object-fit: cover;
	}

	.profile-name {
		font-size: 24px;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 4px;
	}

	.profile-username {
		font-size: 14px;
		color: var(--text-muted);
	}

	.public-links {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.public-link {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 16px 20px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 12px;
		text-decoration: none;
		transition: all var(--duration-normal) var(--ease-out);
	}

	.public-link:hover {
		border-color: var(--accent);
		box-shadow: 0 0 20px color-mix(in srgb, var(--accent) 15%, transparent);
	}

	.link-slug {
		font-size: 16px;
		font-weight: 500;
		color: var(--text-primary);
	}

	.link-dest {
		font-size: 13px;
		color: var(--text-muted);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.profile-container {
			padding: 0 16px;
		}

		.links-table th,
		.links-table td {
			padding: 10px 12px;
		}

		/* Hide less important columns on mobile */
		.links-table th:nth-child(5),
		.links-table td:nth-child(5),
		.links-table th:nth-child(6),
		.links-table td:nth-child(6) {
			display: none;
		}
	}
</style>
