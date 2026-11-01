// The iksi browser extension calls /api/shorten from its own origin
// (chrome-extension://…, moz-extension://…). With its host permission the
// browser usually skips CORS, but not always (Firefox when the user has not
// granted the host, for one), so the endpoint answers extension origins
// explicitly. Credentials are never allowed: keyed requests carry their own
// Authorization header, and the session cookie must not ride along.

const EXTENSION_ORIGIN = /^(chrome-extension|moz-extension|safari-web-extension):\/\/[A-Za-z0-9-]+$/;

export function isExtensionOrigin(origin: string | null): origin is string {
	return !!origin && EXTENSION_ORIGIN.test(origin);
}

function appendVary(headers: Headers) {
	const vary = headers.get('vary');
	if (!vary) headers.set('vary', 'Origin');
	else if (!/(^|,)\s*origin\s*(,|$)/i.test(vary)) headers.set('vary', `${vary}, Origin`);
}

/** Lets an extension read this response. Other origins are left as they were. */
export function withExtensionCors(request: Request, response: Response): Response {
	const origin = request.headers.get('origin');
	appendVary(response.headers);
	if (isExtensionOrigin(origin)) response.headers.set('access-control-allow-origin', origin);
	return response;
}

/** The answer to a CORS preflight: a grant for extension origins, nothing for anyone else. */
export function extensionPreflight(request: Request): Response {
	const headers = new Headers({ allow: 'POST, OPTIONS' });
	const origin = request.headers.get('origin');
	if (isExtensionOrigin(origin)) {
		headers.set('access-control-allow-origin', origin);
		headers.set('access-control-allow-methods', 'POST');
		headers.set('access-control-allow-headers', 'Authorization, Content-Type');
		headers.set('access-control-max-age', '86400');
	}
	appendVary(headers);
	return new Response(null, { status: 204, headers });
}
