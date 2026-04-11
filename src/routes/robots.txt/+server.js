const ADMIN_HOSTS = ['admin.iksi.app', 'admin.localhost'];

const ADMIN_ROBOTS = `User-agent: *
Disallow: /
`;

const PUBLIC_ROBOTS = `User-agent: *
Allow: /
Disallow: /api/

Sitemap: https://www.iksi.app/sitemap.xml
`;

export const GET = ({ request }) => {
	const host = request.headers.get('host')?.split(':')[0] ?? '';
	const body = ADMIN_HOSTS.includes(host) ? ADMIN_ROBOTS : PUBLIC_ROBOTS;

	return new Response(body, {
		headers: {
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
