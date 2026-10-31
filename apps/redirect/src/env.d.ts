import type { Env as WorkerEnv } from './handler';

declare global {
	namespace Cloudflare {
		interface Env extends WorkerEnv {}
	}
}
