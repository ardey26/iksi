import { writable } from 'svelte/store';

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const shortURL = writable('');

// export const shortenURL = async(longURL) => {
//   const data = await prisma.uRL.create({

//   })
// }
