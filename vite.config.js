import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),
			// Pin the serverless function next to the Supabase database (ap-southeast-1).
			// Every DB round trip was crossing the Pacific from Vercel's default iad1.
			adapter: adapter({ runtime: 'nodejs22.x', regions: ['sin1'] })
		}),
		svelteTesting()
	],
	build: {
		target: 'es2020',
		cssCodeSplit: true
	},
	css: {
		devSourcemap: false
	},
	server: {
		fs: {
			strict: false
		}
	},
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		environment: 'jsdom',
		globals: true,
		setupFiles: ['./src/test/setup.js']
	}
});
