<script>
	import { page } from '$app/state';

	const COPY = {
		404: { title: 'Page not found', body: "This page doesn't exist, or the link was mistyped." },
		410: { title: 'Gone', body: 'This page has been removed.' },
		403: { title: 'Not allowed', body: "You don't have access to this page." }
	};

	const copy = $derived(
		COPY[page.status] ?? { title: 'Something went wrong', body: 'Try again in a moment.' }
	);
</script>

<!-- The root layout's <SEO> already marks this path noindex; only the title is set here. -->
<svelte:head>
	<title>{copy.title} — iksi</title>
</svelte:head>

<div class="w-full max-w-[500px] m-auto text-center">
	<p class="text-sm tabular-nums" style="color: var(--text-muted);">{page.status}</p>
	<h1 class="mt-2 text-2xl font-semibold tracking-tight" style="color: var(--text-primary);">
		{copy.title}
	</h1>
	<p class="mt-2 text-sm" style="color: var(--text-muted);">{copy.body}</p>
	<a
		href="/"
		class="inline-flex items-center justify-center mt-6 px-5 text-sm font-medium rounded-lg transition-opacity hover:opacity-90"
		style="background: var(--text-primary); color: var(--bg); height: 44px;"
	>
		Shorten a link
	</a>
</div>
