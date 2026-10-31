import type { RequestEvent } from '@sveltejs/kit';
import { continentOf, parseUserAgent, referrerHost, type RequestContext } from '@iksi/core';
import { clientOf } from '#lib/server/client.js';

/** What routing rules can match on, read from the request. Every field degrades to a safe default. */
export function requestContext(event: Pick<RequestEvent, 'request' | 'getClientAddress'>, now: number): RequestContext {
  const headers = event.request.headers;
  const { country } = clientOf(event);
  const agent = parseUserAgent(headers.get('user-agent'));
  return {
    country,
    continent: continentOf(country),
    device: agent.device,
    os: agent.os,
    referrerHost: referrerHost(headers.get('referer')),
    now
  };
}
