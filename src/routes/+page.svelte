<script>
	import { InvalidUrl, Input, ShortenedURL } from '../lib/components/';
	import SEO from '../lib/components/SEO.svelte';
	
	let longURL = '';
	let shortURL = '';
	let customURL = '';
	let isLoading = false;

	let error = '';
	let copied = false;
	
	// Structured data for SEO
	const structuredData = {
		"@context": "https://schema.org",
		"@type": "WebApplication",
		"name": "iksi",
		"description": "Free URL shortener that transforms long URLs into clean, shareable links with custom options and lightning-fast redirects.",
		"url": "https://iksi.vercel.app",
		"applicationCategory": "UtilitiesApplication",
		"operatingSystem": "Any",
		"offers": {
			"@type": "Offer",
			"price": "0",
			"priceCurrency": "USD"
		},
		"creator": {
			"@type": "Person",
			"name": "Andre de Jesus",
			"email": "dejesusandre0226@gmail.com"
		},
		"keywords": "URL shortener, link shortener, custom links, free, fast, reliable",
		"aggregateRating": {
			"@type": "AggregateRating",
			"ratingValue": "4.8",
			"reviewCount": "100"
		}
	};

	const handleSubmit = async (e) => {
		isLoading = true;
		const response = await fetch('/api/shorten', {
			method: 'POST',
			body: JSON.stringify({ longURL: longURL.trim(), customURL: customURL.trim() }),
			headers: {
				'content-type': 'application/json'
			}
		});
		const data = await response.json();

		shortURL = data.shortURL;
		error = data.error;

		if (error) {
			await new Promise((res) => setTimeout(res, 3000));
			error = '';
		}

		isLoading = false;
	};
</script>

<!-- SEO Meta Tags -->
<SEO 
	title="iksi - Free URL Shortener | Make Long Links Short & Sweet 🍯"
	description="Transform long URLs into clean, shareable links with iksi. Free URL shortener with custom links, analytics, and lightning-fast redirects. No registration required."
	keywords="URL shortener, link shortener, custom links, short links, free URL shortener, link management, iksi, fast redirects"
	canonical="https://iksi.vercel.app"
	ogImage="https://iksi.vercel.app/og-image.png"
	{structuredData}
/>

<section class="w-full max-w-md mx-auto px-4 sm:px-6" aria-label="URL Shortener Tool">
	<!-- Ambient light effects - hidden on mobile for performance -->
	
	
	<!-- Main card with liquid glass effect -->
	<article class="liquid-glass p-4 sm:p-6 md:p-8 space-y-4 fade-in-up">
		<main>
			<Input bind:longURL bind:customURL bind:isLoading {handleSubmit} />

			<ShortenedURL {shortURL} bind:copied />

			{#if error}
				<InvalidUrl {error} />
			{/if}
		</main>
	</article>
</section>
