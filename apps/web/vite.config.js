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
		globals: true,
		setupFiles: ['./src/test/setup.js'],
		projects: [
			{
				extends: true,
				test: {
					name: 'dom',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.node.test.{js,ts}'],
					environment: 'jsdom'
				}
			},
			{
				// svelteTesting adds the `browser` resolve condition, which makes the AWS SDK
				// load its ESM browser build (extensionless imports that break under Node).
				// Tests that touch the SDK run here, with Node resolution.
				extends: true,
				plugins: [],
				resolve: { conditions: ['node'] },
				test: {
					name: 'node',
					include: ['src/**/*.node.test.{js,ts}'],
					environment: 'node'
				}
			}
		]
	}
});
