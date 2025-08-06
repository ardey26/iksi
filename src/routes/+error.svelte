<script>
	import SEO from '$lib/components/SEO.svelte';
	
	const structuredData = {
		"@context": "https://schema.org",
		"@type": "WebPage",
		"name": "Page Not Found - iksi",
		"description": "The page you're looking for doesn't exist. Return to iksi homepage to shorten your URLs.",
		"url": "https://iksi.vercel.app/404"
	};
</script>

<SEO 
	title="Page Not Found - iksi URL Shortener"
	description="The page you're looking for doesn't exist. Return to iksi homepage to shorten your URLs for free."
	canonical="https://iksi.vercel.app/404"
	{structuredData}
/>

<section class="w-full max-w-md relative px-4" aria-label="Error Page">
	<article class="liquid-glass p-8 space-y-6 fade-in-up text-center">
		<header>
			<h1 class="text-4xl font-bold mb-4" style="color: var(--apple-text);">404</h1>
			<h2 class="text-xl font-semibold mb-2" style="color: var(--apple-text);">Page Not Found</h2>
			<p class="text-sm" style="color: var(--apple-text-secondary);">
				Oops! The link you clicked seems to be broken or the page doesn't exist.
			</p>
		</header>
		
		<main>
			<div class="space-y-4">
				<a 
					href="/" 
					class="apple-button w-full inline-block text-center"
					aria-label="Return to homepage"
				>
					Back to Homepage
				</a>
				
				<p class="text-xs" style="color: var(--apple-text-secondary);">
					Want to create a short link? Head back to our homepage!
				</p>
			</div>
		</main>
	</article>
</section>
