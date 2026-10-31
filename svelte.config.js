import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/kit/vite';
import path from 'path';
/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Pin the serverless function next to the Supabase database (ap-southeast-1).
		// Every DB round trip was crossing the Pacific from Vercel's default iad1.
		adapter: adapter({ runtime: 'nodejs22.x', regions: ['sin1'] }),
		alias: {
			$components: path.resolve('./src/lib/components')
		}
	},
	preprocess: vitePreprocess()
};

export default config;
