import { redirect } from '@sveltejs/kit';
import { verifyUserSession, deleteUserSession } from '$lib/server/auth.js';

export const POST = async ({ cookies }) => {
  const token = cookies.get('session');

  if (token) {
    // Verify signature before deleting to prevent arbitrary session deletion
    const user = await verifyUserSession(token);
    if (user) {
      const sessionId = token.slice(0, token.indexOf('.'));
      try {
        await deleteUserSession(sessionId);
      } catch {
        // Session may already be deleted — that's fine
      }
    }
  }

  cookies.delete('session', { path: '/' });
  throw redirect(302, '/');
};
