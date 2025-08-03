import { PrismaClient } from '@prisma/client';

// Global instance to prevent connection leaks
let prisma;

if (typeof window === 'undefined') {
	if (process.env.NODE_ENV === 'production') {
		prisma = new PrismaClient();
	} else {
		// In development, use a global variable to preserve the instance
		// across hot reloads
		if (!global.__prisma) {
			global.__prisma = new PrismaClient();
		}
		prisma = global.__prisma;
	}
}

export { prisma };
