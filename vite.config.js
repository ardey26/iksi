import { sveltekit } from '@sveltejs/kit/vite';

const config = {
	plugins: [sveltekit()],
	build: {
		target: 'es2020',
		cssCodeSplit: true,
		rollupOptions: {
			output: {
				manualChunks: {
					// Remove @prisma/client from manual chunks since it's external
					utils: ['src/lib/utils/validation.js', 'src/lib/utils/clipboard.js']
				}
			}
		}
	},
	// Remove @prisma/client from optimizeDeps since it's server-side only
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
