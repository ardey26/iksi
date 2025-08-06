<script>
	import SEO from '$lib/components/SEO.svelte';
	
	let password = '';
	let error = '';
	let loading = false;
	
	const handleLogin = async (e) => {
		e.preventDefault();
		loading = true;
		error = '';
		
		try {
			const response = await fetch('/admin/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ password })
			});
			
			const result = await response.json();
			
			if (result.success) {
				window.location.href = '/admin';
			} else {
				error = result.error || 'Invalid password';
			}
		} catch (err) {
			error = 'Login failed. Please try again.';
		} finally {
			loading = false;
		}
	};
	
	const structuredData = {
		"@context": "https://schema.org",
		"@type": "WebPage",
		"name": "Admin Login - iksi",
		"description": "Admin login for iksi URL shortener dashboard.",
		"url": "https://iksi.vercel.app/admin/login"
	};
</script>

<SEO 
	title="Admin Login - iksi URL Shortener"
	description="Admin login for accessing the iksi URL shortener dashboard."
	canonical="https://iksi.vercel.app/admin/login"
	{structuredData}
/>

<section class="w-full max-w-md relative px-4" aria-label="Admin Login">
	<div class="liquid-glass p-8 fade-in-up">
		<div class="text-center mb-8">
			<h1 class="text-2xl font-bold mb-2" style="color: var(--apple-text);">
				Admin Login
			</h1>
			<p class="text-sm" style="color: var(--apple-text-secondary);">
				Enter your admin password to access the dashboard
			</p>
		</div>
		
		<form on:submit={handleLogin} class="space-y-6">
			<div>
				<label for="password" class="block text-sm font-medium mb-2" style="color: var(--apple-text);">
					Password
				</label>
				<input
					type="password"
					id="password"
					bind:value={password}
					required
					disabled={loading}
					class="w-full px-4 py-3 rounded-xl border transition-all focus:outline-none focus:ring-2"
					style="background: var(--apple-surface); border-color: var(--apple-border); color: var(--apple-text); focus:ring-color: var(--apple-blue);"
					placeholder="Enter admin password"
				/>
			</div>
			
			{#if error}
				<div class="text-sm p-3 rounded-lg" style="background: rgba(255, 69, 58, 0.1); color: var(--apple-red);">
					{error}
				</div>
			{/if}
			
			<button
				type="submit"
				disabled={loading || !password.trim()}
				class="w-full py-3 px-6 rounded-xl font-medium transition-all disabled:opacity-50"
				style="background: var(--apple-blue); color: white;"
			>
				{loading ? 'Logging in...' : 'Login'}
			</button>
		</form>
		
		<div class="mt-6 text-center">
			<a 
				href="/" 
				class="text-sm" 
				style="color: var(--apple-text-secondary);"
			>
				← Back to iksi
			</a>
		</div>
	</div>
</section>
