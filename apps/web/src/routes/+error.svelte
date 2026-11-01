<script>
	import { page } from '$app/state';
	import { Button } from '#lib/ui/index.js';
	import Interstitial from '#lib/components/Interstitial.svelte';

	const COPY = {
		404: { icon: 'search', title: 'Page not found', body: "This page doesn't exist, or the link was mistyped." },
		410: { icon: 'clock', title: 'Gone', body: 'This page has been removed.' },
		403: { icon: 'lock', title: 'Not allowed', body: "You don't have access to this page." }
	};

	const copy = $derived(
		COPY[page.status] ?? { icon: 'alert', title: 'Something went wrong', body: 'Try again in a moment.' }
	);
</script>

<!-- The root layout's <SEO> already marks this path noindex; only the title is set here. -->
<svelte:head>
	<title>{copy.title} — iksi</title>
</svelte:head>

<Interstitial icon={copy.icon} title={copy.title} description={copy.body}>
	<Button variant="primary" size="lg" full href="/">Shorten a link</Button>
</Interstitial>
