import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	plugins: [sveltekit()],
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
	},
	resolve: {
		alias: {
			$lib: path.resolve('./src/lib')
		}
	}
});
