import { prisma } from '$lib/prisma.js';
import { authError } from '$lib/server/authError.js';

export const DELETE = async ({ params, locals }) => {
  if (!locals.user) {
    return authError('UNAUTHORIZED', 'Authentication required', 401);
  }

  const apiKey = await prisma.apiKey.findUnique({
    where: { id: params.id },
    select: { userId: true }
  });

  if (!apiKey) {
    return authError('NOT_FOUND', 'API key not found', 404);
  }

  if (apiKey.userId !== locals.user.id) {
    return authError('FORBIDDEN', 'Not your API key', 403);
  }

  await prisma.apiKey.delete({ where: { id: params.id } });

  return new Response(JSON.stringify({ deleted: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
};
