import { prisma } from '$lib/prisma.js';
import { generateApiKey } from '$lib/server/auth.js';
import { authError } from '$lib/server/authError.js';

export const GET = async ({ locals }) => {
  if (!locals.user) {
    return authError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: locals.user.id },
    select: {
      id: true,
      name: true,
      keyPreview: true,
      lastUsedAt: true,
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  });

  return new Response(JSON.stringify({ keys }), {
    headers: { 'Content-Type': 'application/json' }
  });
};

export const POST = async ({ request, locals }) => {
  if (!locals.user) {
    return authError('UNAUTHORIZED', 'Authentication required', 401);
  }

  let name = null;
  try {
    const body = await request.json();
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.length > 100) {
        return authError('VALIDATION_ERROR', 'Name must be a string under 100 characters', 400);
      }
      name = body.name.trim() || null;
    }
  } catch {
    // Empty body is fine — name is optional
  }

  const { raw, hash, preview } = generateApiKey();

  await prisma.apiKey.create({
    data: {
      userId: locals.user.id,
      keyHash: hash,
      keyPreview: preview,
      name
    }
  });

  return new Response(JSON.stringify({ key: raw, preview }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
};
