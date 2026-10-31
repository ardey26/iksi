import { handleRequest, type Env } from './handler';

export default {
	fetch: handleRequest
} satisfies ExportedHandler<Env>;
