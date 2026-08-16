import type { RequestHandler } from './$types';
import { ImageResponse } from '@vercel/og';

export const GET: RequestHandler = async ({ params }) => {
  const raw = params.handle;
  const handle = (raw.startsWith('@') ? raw.slice(1) : raw).toLowerCase();

  const { prisma } = await import('$lib/prisma.js');
  const record = await prisma.handle.findUnique({
    where: { handle },
    include: {
      user: {
        include: {
          profile: {
            include: {
              rows: {
                where: { enabled: true, quarantined: false, NOT: { linkId: null } },
                orderBy: { position: 'asc' },
                take: 1
              }
            }
          }
        }
      }
    }
  });
  if (!record?.user?.profile) return new Response('not found', { status: 404 });
  const p = record.user.profile;
  const topRow = p.rows[0];

  const children: any[] = [];
  if (p.avatarUrl) {
    children.push({
      type: 'img',
      props: {
        src: p.avatarUrl,
        width: 120,
        height: 120,
        style: { borderRadius: 60, marginBottom: 24 }
      }
    });
  }
  children.push({
    type: 'div',
    props: { style: { fontSize: 48, fontWeight: 600 }, children: p.displayName ?? `@${handle}` }
  });
  children.push({
    type: 'div',
    props: { style: { fontSize: 24, color: '#A1A1AA', marginTop: 8 }, children: `@${handle}` }
  });
  if (topRow) {
    children.push({
      type: 'div',
      props: { style: { fontSize: 20, color: '#A1A1AA', marginTop: 24 }, children: topRow.title }
    });
  }

  return new ImageResponse(
    {
      type: 'div',
      props: {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#0A0A0B',
          color: '#FAFAFA',
          fontFamily: 'sans-serif'
        },
        children
      }
    } as any,
    {
      width: 1200,
      height: 630,
      headers: { 'Cache-Control': 'public, max-age=3600' }
    }
  );
};
