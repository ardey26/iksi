import { redirect, fail } from '@sveltejs/kit';
import { Prisma } from '@prisma/client';
import { prisma } from '$lib/prisma.js';
import { isValidUsername, normalizeUsername } from '$lib/utils/username.js';

export const load = async ({ locals }) => {
  // Must be logged in
  if (!locals.user) {
    throw redirect(302, '/');
  }

  // If user already has username, redirect to their profile
  if (locals.user.username) {
    throw redirect(302, `https://${locals.user.username}.iksi.app`);
  }

  // Generate suggested username from name
  let suggestedUsername = '';
  if (locals.user.name) {
    const sanitized = locals.user.name
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/gi, '')
      .replace(/^-+|-+$/g, ''); // Trim leading/trailing hyphens
    if (sanitized.length >= 3) {
      suggestedUsername = normalizeUsername(sanitized);
    }
  }

  return { suggestedUsername };
};

export const actions = {
  default: async ({ request, locals }) => {
    if (!locals.user) {
      throw redirect(302, '/');
    }

    const formData = await request.formData();
    const rawUsername = formData.get('username')?.toString() || '';

    // Validate
    const validation = isValidUsername(rawUsername);
    if (!validation.valid) {
      return fail(400, { error: validation.error, username: rawUsername });
    }

    const username = normalizeUsername(rawUsername);

    // Check uniqueness
    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true }
    });

    if (existing) {
      return fail(400, { error: 'This username is already taken', username: rawUsername });
    }

    // Update user - handle race condition where another user claims the username
    // between our check and update
    try {
      await prisma.user.update({
        where: { id: locals.user.id },
        data: { username }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return fail(400, { error: 'This username is already taken', username: rawUsername });
      }
      throw error;
    }

    // Redirect to their new profile
    throw redirect(302, `https://${username}.iksi.app`);
  }
};
