<script>
	export let title = 'iksi - URL Shortener | Make Long Links Short & Sweet';
	export let description = 'Transform long URLs into clean, shareable links with iksi. Free URL shortener with custom links, analytics, and lightning-fast redirects. No registration required.';
	export let keywords = 'URL shortener, link shortener, custom links, short links, free URL shortener, link management, iksi';
	export let canonical = '';
	export let ogImage = '/og-image.png';
	export let ogType = 'website';
	export let twitterCard = 'summary_large_image';
	export let structuredData = null;
</script>

<svelte:head>
	<!-- Primary Meta Tags -->
	<title>{title}</title>
	<meta name="title" content={title} />
	<meta name="description" content={description} />
	<meta name="keywords" content={keywords} />
	<meta name="author" content="Andre de Jesus" />
	<meta name="robots" content="index, follow" />
	<meta name="language" content="English" />
	<meta name="revisit-after" content="7 days" />
	
	<!-- Canonical URL -->
	{#if canonical}
		<link rel="canonical" href={canonical} />
	{/if}
	
	<!-- Open Graph / Facebook -->
	<meta property="og:type" content={ogType} />
	<meta property="og:url" content={canonical || 'https://iksi.vercel.app'} />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={ogImage} />
	<meta property="og:site_name" content="iksi" />
	<meta property="og:locale" content="en_US" />
	
	<!-- Twitter -->
	<meta property="twitter:card" content={twitterCard} />
	<meta property="twitter:url" content={canonical || 'https://iksi.vercel.app'} />
	<meta property="twitter:title" content={title} />
	<meta property="twitter:description" content={description} />
	<meta property="twitter:image" content={ogImage} />
	<meta property="twitter:creator" content="@iksi_app" />
	
	<!-- Additional SEO Meta Tags -->
	<meta name="theme-color" content="#007AFF" />
	<meta name="msapplication-TileColor" content="#007AFF" />
	<meta name="application-name" content="iksi" />
	<meta name="apple-mobile-web-app-title" content="iksi" />
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="default" />
	<meta name="mobile-web-app-capable" content="yes" />
	
	<!-- Structured Data -->
	{#if structuredData}
		{@html `<script type="application/ld+json">${JSON.stringify(structuredData)}</script>`}
	{/if}
	
	<!-- Favicon and Icons -->
	<link rel="icon" type="image/png" href="/favicon.png" />
	<link rel="apple-touch-icon" href="/favicon.png" />
	<link rel="manifest" href="/manifest.json" />
</svelte:head>
