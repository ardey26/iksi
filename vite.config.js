import { sveltekit } from '@sveltejs/kit/vite';

const config = {
	plugins: [sveltekit()],
	build: {
		target: 'es2020',
		cssCodeSplit: true,
		rollupOptions: {
			output: {
				manualChunks: {
					vendor: ['@prisma/client'],
					utils: ['src/lib/utils/validation.js', 'src/lib/utils/clipboard.js']
				}
			}
		}
	},
	optimizeDeps: {
		include: ['@prisma/client']
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
