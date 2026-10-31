import { handleQueue } from './consumer';
import { handleRequest, type Env } from './handler';

export default {
	fetch: handleRequest,
	queue: handleQueue
} satisfies ExportedHandler<Env>;
