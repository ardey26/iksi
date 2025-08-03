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

<section class="w-full max-w-md mx-auto px-4 sm:px-6 relative" aria-label="URL Shortener Tool">
	<!-- Beautiful animated background -->
	<div class="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
		<!-- Main gradient background -->
		<div class="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"></div>
		
		<!-- Animated gradient overlays -->
		<div class="absolute inset-0 bg-gradient-to-tr from-blue-500/20 via-transparent to-purple-500/20 animate-pulse"></div>
		<div class="absolute inset-0 bg-gradient-to-bl from-pink-500/10 via-transparent to-blue-500/10 animate-pulse" style="animation-delay: 1s;"></div>
		
		<!-- Floating orbs -->
		<div class="absolute top-1/4 left-1/4 w-32 h-32 bg-blue-400/30 rounded-full blur-xl animate-bounce" style="animation-duration: 3s;"></div>
		<div class="absolute top-3/4 right-1/4 w-24 h-24 bg-purple-400/30 rounded-full blur-xl animate-bounce" style="animation-duration: 4s; animation-delay: 1.5s;"></div>
		<div class="absolute top-1/2 left-3/4 w-20 h-20 bg-pink-400/20 rounded-full blur-xl animate-bounce" style="animation-duration: 5s; animation-delay: 2s;"></div>
		
		<!-- Subtle grid pattern -->
		<div class="absolute inset-0 opacity-10" style="background-image: radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0); background-size: 20px 20px;"></div>
		
		<!-- Light rays effect -->
		<div class="absolute top-0 left-1/2 transform -translate-x-1/2 w-px h-32 bg-gradient-to-b from-white/40 to-transparent"></div>
		<div class="absolute bottom-0 right-1/3 w-px h-24 bg-gradient-to-t from-blue-400/40 to-transparent"></div>
	</div>
	
	<!-- Ambient light effects for the card -->
	<div class="absolute -top-20 -left-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl animate-pulse hidden sm:block"></div>
	<div class="absolute -bottom-20 -right-20 w-40 h-40 bg-purple-500/20 rounded-full blur-3xl animate-pulse hidden sm:block" style="animation-delay: 1s;"></div>
	
	<!-- Main card with liquid glass effect -->
	<article class="liquid-glass p-4 sm:p-6 md:p-8 space-y-4 fade-in-up relative z-10">
		<main>
			<Input bind:longURL bind:customURL bind:isLoading {handleSubmit} />

			<ShortenedURL {shortURL} bind:copied />

			{#if error}
				<InvalidUrl {error} />
			{/if}
		</main>
	</article>
</section>
