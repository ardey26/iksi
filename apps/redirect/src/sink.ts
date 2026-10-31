import type { ClickEvent, EventSink } from '@iksi/core';

export function queueEventSink(queue: Queue<ClickEvent>): EventSink {
	return {
		async emit(event) {
			await queue.send(event);
		}
	};
}
