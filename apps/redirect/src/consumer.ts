import { parseClickEvent, type ClickEvent } from "@iksi/core";
import type { Env, Upstream } from "./handler";

const DEFAULT_ORIGIN = "https://www.iksi.app";
const RETRY_DELAY_SECONDS = 30;

export interface QueueDeps {
  upstream: Upstream;
}

/**
 * Delivers click batches to the origin. Malformed messages can never succeed, so
 * they are acked (and logged) straight away; valid ones are acked only once the
 * origin has stored them, and retried together otherwise.
 */
export function createQueueHandler(deps: QueueDeps) {
  return async (batch: MessageBatch<unknown>, env: Env): Promise<void> => {
    const valid: { message: Message<unknown>; event: ClickEvent }[] = [];
    for (const message of batch.messages) {
      const event = parseClickEvent(message.body);
      if (event) {
        valid.push({ message, event });
      } else {
        console.warn("dropping invalid click event");
        message.ack();
      }
    }
    if (valid.length === 0) return;

    const retryAll = () => {
      for (const { message } of valid)
        message.retry({ delaySeconds: RETRY_DELAY_SECONDS });
    };

    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (env.EDGE_SECRET) headers["x-iksi-edge"] = env.EDGE_SECRET;
      const response = await deps.upstream(
        new Request(`${env.ORIGIN_URL ?? DEFAULT_ORIGIN}/internal/ingest`, {
          method: "POST",
          headers,
          body: JSON.stringify({ events: valid.map((v) => v.event) }),
        }),
      );
      if (!response.ok) {
        console.error(
          `click ingest failed with status ${response.status} for ${valid.length} events`,
        );
        retryAll();
        return;
      }
    } catch (error) {
      console.error(`click ingest failed for ${valid.length} events`, error);
      retryAll();
      return;
    }
    for (const { message } of valid) message.ack();
  };
}

export const handleQueue = createQueueHandler({
  upstream: (request) => fetch(request),
});
