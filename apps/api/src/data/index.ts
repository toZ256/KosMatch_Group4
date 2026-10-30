import { PrismaClient } from '@prisma/client';
import { InMemoryRepository } from './inMemoryRepository';
import { PrismaRepository } from './prismaRepository';
import type { Repository } from './repository';
import { seedRepository } from './seed';

/** Selects the Repository implementation from DATA_STORE. */
export async function createRepository(dataStore: string): Promise<Repository> {
  if (dataStore === 'postgres') {
    const prisma = new PrismaClient();
    return new PrismaRepository(prisma);
  }
  if (dataStore === 'memory') {
    const repo = new InMemoryRepository();
    await seedRepository(repo);
    return repo;
  }
  throw new Error('Provider belum diimplementasikan');
}
