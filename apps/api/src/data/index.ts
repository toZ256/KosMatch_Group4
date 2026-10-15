import { InMemoryRepository } from './inMemoryRepository';
import type { Repository } from './repository';
import { seedRepository } from './seed';

/** Selects the Repository implementation from DATA_STORE. */
export async function createRepository(dataStore: string): Promise<Repository> {
  if (dataStore !== 'memory') {
    throw new Error('Provider belum diimplementasikan');
  }
  const repo = new InMemoryRepository();
  await seedRepository(repo);
  return repo;
}
