import { sveltekit } from '@sveltejs/kit/vite';

const config = {
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
	}
};

export default config;
