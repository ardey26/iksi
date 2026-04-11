import { error } from '@sveltejs/kit';

export const load = async ({ locals }) => {
	// profileUser is set in hooks.server.ts from subdomain
	if (!locals.profileUser) {
		throw error(404, 'User not found');
	}

	const isOwner = locals.user?.id === locals.profileUser.id;

	return {
		profileUser: locals.profileUser,
		isOwner,
		currentUser: locals.user
	};
};
