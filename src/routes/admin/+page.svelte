<script>
	import SEO from '$lib/components/SEO.svelte';
	import { onMount } from 'svelte';
	
	export let data;
	
	let dailyChart;
	let hourlyChart;
	
	const logout = async () => {
		await fetch('/admin/logout', {
			method: 'POST'
		});
		window.location.href = '/admin/login';
	};
	
	const formatDate = (dateString) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};
	
	onMount(async () => {
		// Import Chart.js dynamically
		const { Chart, registerables } = await import('chart.js');
		Chart.register(...registerables);
		
		// Create daily chart
		const dailyCtx = document.getElementById('dailyChart').getContext('2d');
		dailyChart = new Chart(dailyCtx, {
			type: 'line',
			data: {
				labels: data.stats.chartData.daily.labels,
				datasets: [{
					label: 'URLs Created',
					data: data.stats.chartData.daily.data,
					borderColor: '#007AFF',
					backgroundColor: 'rgba(0, 122, 255, 0.1)',
					borderWidth: 3,
					fill: true,
					tension: 0.4
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: false
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							stepSize: 1
						},
						grid: {
							color: 'rgba(255, 255, 255, 0.1)'
						}
					},
					x: {
						grid: {
							color: 'rgba(255, 255, 255, 0.1)'
						}
					}
				}
			}
		});
		
		// Create hourly chart
		const hourlyCtx = document.getElementById('hourlyChart').getContext('2d');
		hourlyChart = new Chart(hourlyCtx, {
			type: 'bar',
			data: {
				labels: data.stats.chartData.hourly.labels,
				datasets: [{
					label: 'URLs Created',
					data: data.stats.chartData.hourly.data,
					backgroundColor: data.stats.chartData.hourly.data.map(value => 
						value === 0 ? 'rgba(52, 199, 89, 0.2)' : 
						value === 1 ? 'rgba(52, 199, 89, 0.5)' : 
						value <= 3 ? 'rgba(52, 199, 89, 0.7)' : 'rgba(52, 199, 89, 1)'
					),
					borderColor: '#34C759',
					borderWidth: 1
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: false
					}
				},
				scales: {
					y: {
						beginAtZero: true,
						ticks: {
							stepSize: 1
						},
						grid: {
							color: 'rgba(255, 255, 255, 0.1)'
						}
					},
					x: {
						grid: {
							color: 'rgba(255, 255, 255, 0.1)'
						}
					}
				}
			}
		});
	});
	
	const structuredData = {
		"@context": "https://schema.org",
		"@type": "WebPage",
		"name": "Admin Dashboard - iksi",
		"description": "Admin dashboard for iksi URL shortener analytics and management.",
		"url": "https://iksi.vercel.app/admin"
	};
</script>

<SEO 
	title="Admin Dashboard - iksi URL Shortener"
	description="Admin dashboard for managing and viewing analytics of the iksi URL shortener service."
	canonical="https://iksi.vercel.app/admin"
	{structuredData}
/>

<section class="w-full max-w-6xl relative px-4" aria-label="Admin Dashboard">
	<div class="space-y-6 fade-in-up">
		<!-- Header -->
		<div class="liquid-glass p-6">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold" style="color: var(--apple-text);">
						Admin Dashboard
					</h1>
					<p class="text-sm" style="color: var(--apple-text-secondary);">
						iksi URL Shortener Analytics
					</p>
				</div>
				
				<div class="flex items-center space-x-4">
					<a 
						href="/" 
						class="px-4 py-2 rounded-xl transition-colors"
						style="background: var(--apple-surface-secondary); border: 1px solid var(--apple-border); color: var(--apple-text);"
					>
						Visit Site
					</a>
					<button
						on:click={logout}
						class="px-4 py-2 rounded-xl transition-colors"
						style="background: var(--apple-red); color: white;"
					>
						Logout
					</button>
				</div>
			</div>
		</div>

		<!-- Stats Overview -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
			<div class="liquid-glass p-6 text-center">
				<div class="text-4xl font-bold mb-2" style="color: var(--apple-blue);">
					{data.stats.totalURLs}
				</div>
				<div class="text-sm" style="color: var(--apple-text-secondary);">
					Total URLs Created
				</div>
			</div>
			
			<div class="liquid-glass p-6 text-center">
				<div class="text-4xl font-bold mb-2" style="color: var(--apple-green);">
					{data.stats.todayURLs}
				</div>
				<div class="text-sm" style="color: var(--apple-text-secondary);">
					URLs Created Today
				</div>
			</div>
			
			<div class="liquid-glass p-6 text-center">
				<div class="text-4xl font-bold mb-2" style="color: var(--apple-orange);">
					{data.stats.chartData.daily.data.reduce((a, b) => a + b, 0)}
				</div>
				<div class="text-sm" style="color: var(--apple-text-secondary);">
					URLs This Week
				</div>
			</div>
		</div>

		<!-- Charts Section -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<!-- Daily URLs Chart -->
			<div class="liquid-glass p-6">
				<h2 class="text-lg font-semibold mb-4" style="color: var(--apple-text);">
					Daily URLs Created (Last 7 Days)
				</h2>
				<div class="relative h-64">
					<canvas id="dailyChart"></canvas>
				</div>
			</div>
			
			<!-- Hourly URLs Chart -->
			<div class="liquid-glass p-6">
				<h2 class="text-lg font-semibold mb-4" style="color: var(--apple-text);">
					URLs Created Today (By Hour)
				</h2>
				<div class="relative h-64">
					<canvas id="hourlyChart"></canvas>
				</div>
			</div>
		</div>

		<!-- Quick Insights -->
		<div class="liquid-glass p-6">
			<h2 class="text-xl font-semibold mb-4" style="color: var(--apple-text);">
				Quick Insights
			</h2>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div class="space-y-3">
					<div class="flex items-center justify-between p-3 rounded-lg" style="background: var(--apple-surface-secondary);">
						<span class="text-sm" style="color: var(--apple-text-secondary);">Most active hour today</span>
						<span class="font-semibold" style="color: var(--apple-text);">
							{data.stats.chartData.hourly.data.indexOf(Math.max(...data.stats.chartData.hourly.data))}:00
						</span>
					</div>
					<div class="flex items-center justify-between p-3 rounded-lg" style="background: var(--apple-surface-secondary);">
						<span class="text-sm" style="color: var(--apple-text-secondary);">Most active day</span>
						<span class="font-semibold" style="color: var(--apple-text);">
							{data.stats.chartData.daily.labels[data.stats.chartData.daily.data.indexOf(Math.max(...data.stats.chartData.daily.data))]}
						</span>
					</div>
				</div>
				<div class="space-y-3">
					<div class="flex items-center justify-between p-3 rounded-lg" style="background: var(--apple-surface-secondary);">
						<span class="text-sm" style="color: var(--apple-text-secondary);">Average per day</span>
						<span class="font-semibold" style="color: var(--apple-text);">
							{Math.round(data.stats.chartData.daily.data.reduce((a, b) => a + b, 0) / 7)} URLs
						</span>
					</div>
					<div class="flex items-center justify-between p-3 rounded-lg" style="background: var(--apple-surface-secondary);">
						<span class="text-sm" style="color: var(--apple-text-secondary);">Growth trend</span>
						<span class="font-semibold" style="color: var(--apple-green);">
							{data.stats.chartData.daily.data[6] >= data.stats.chartData.daily.data[0] ? '📈 Growing' : '📉 Declining'}
						</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
