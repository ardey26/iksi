import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSession, verifyPassword } from '$lib/server/auth.js';
import { dev } from '$app/environment';

export const POST: RequestHandler = async ({ request, cookies }) => {
  try {
    const { password } = await request.json();
    const ok = await verifyPassword(password);
    if (!ok) return json({ success: false, error: 'Invalid password' }, { status: 401 });

    cookies.set('admin_session', createSession(), {
      path: '/',
      httpOnly: true,
      secure: !dev,
      sameSite: 'lax',
      domain: dev ? undefined : 'admin.iksi.app',
      maxAge: 60 * 60 * 24 * 7
    });
    return json({ success: true });
  } catch (err) {
    console.error('Login error:', err);
    return json({ success: false, error: 'Login failed' }, { status: 500 });
  }
};
