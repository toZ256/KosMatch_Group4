import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryRepository } from './inMemoryRepository';
import { createRepository } from './index';
import { seedRepository } from './seed';

describe('InMemoryRepository', () => {
  let repo: InMemoryRepository;
  beforeEach(() => {
    repo = new InMemoryRepository();
  });

  const baseKos = {
    ownerId: 'o1',
    namaKos: 'Kos Uji',
    hargaSewa: 1000000,
    latitude: 0,
    longitude: 0,
    area: 'Tes',
    tipe: 'putra' as const,
    fasilitas: ['AC'],
    deskripsi: 'Deskripsi',
    rating: 4,
    fotoColor: '#fff',
  };

  it('supports kos CRUD and filters', async () => {
    const created = await repo.kos.create(baseKos);
    await repo.kos.create({ ...baseKos, namaKos: 'Mahal', hargaSewa: 5000000, tipe: 'putri' });
    expect((await repo.kos.get(created.id))?.namaKos).toBe('Kos Uji');
    expect(await repo.kos.list({ maxPrice: 2000000 })).toHaveLength(1);
    expect(await repo.kos.list({ tipe: 'putri' })).toHaveLength(1);
    expect(await repo.kos.list({ q: 'mahal' })).toHaveLength(1);
    expect(await repo.kos.listByOwner('o1')).toHaveLength(2);
    expect((await repo.kos.update(created.id, { hargaSewa: 1200000 }))?.hargaSewa).toBe(1200000);
    expect(await repo.kos.update('missing', {})).toBeNull();
    expect(await repo.kos.remove(created.id)).toBe(true);
    expect(await repo.kos.remove(created.id)).toBe(false);
  });

  it('adds bookmarks idempotently and removes them', async () => {
    const a = await repo.bookmarks.add('u1', 'k1');
    const b = await repo.bookmarks.add('u1', 'k1');
    expect(b.id).toBe(a.id);
    expect(await repo.bookmarks.listByUser('u1')).toHaveLength(1);
    expect(await repo.bookmarks.listByUser('u2')).toHaveLength(0);
    expect(await repo.bookmarks.remove('u1', 'k1')).toBe(true);
    expect(await repo.bookmarks.remove('u1', 'k1')).toBe(false);
  });

  it('returns chats between two users in order and builds conversations', async () => {
    await repo.chats.add({ senderId: 'a', receiverId: 'b', pesan: 'satu', sentAt: '2026-01-01T00:00:00.000Z' });
    await repo.chats.add({ senderId: 'b', receiverId: 'a', pesan: 'dua', sentAt: '2026-01-01T00:01:00.000Z' });
    await repo.chats.add({ senderId: 'c', receiverId: 'a', pesan: 'tiga', sentAt: '2026-01-01T00:02:00.000Z' });
    expect((await repo.chats.between('a', 'b')).map((m) => m.pesan)).toEqual(['satu', 'dua']);
    const convs = await repo.chats.conversations('a');
    expect(convs.map((c) => c.otherUserId)).toEqual(['c', 'b']);
    expect(convs[1]?.last.pesan).toBe('dua');
  });

  it('finds users by email case-insensitively', async () => {
    const u = await repo.users.create({ nama: 'A', email: 'A@x.test', passwordHash: 'h', role: 'tenant' });
    expect((await repo.users.findByEmail('a@X.test'))?.id).toBe(u.id);
    expect(await repo.users.findById('nope')).toBeNull();
  });
});

describe('seed', () => {
  it('loads accounts, 11 destinations, 12 kos, 3 chats and 2 bookmarks', async () => {
    const repo = new InMemoryRepository();
    await seedRepository(repo);
    const tenant = await repo.users.findByEmail('tenant@kosmatch.test');
    const owner = await repo.users.findByEmail('owner@kosmatch.test');
    expect(tenant && owner).toBeTruthy();
    expect(await repo.destinations.list()).toHaveLength(11);
    expect(await repo.kos.list()).toHaveLength(12);
    expect(await repo.bookmarks.listByUser(tenant!.id)).toHaveLength(2);
    expect(await repo.chats.between(tenant!.id, owner!.id)).toHaveLength(3);
    expect(tenant!.passwordHash).not.toBe('password123');
  });

  it('throws a clear error for unsupported data stores', async () => {
    await expect(createRepository('mysql')).rejects.toThrow('Provider belum diimplementasikan');
  });

  it('creates a PrismaRepository for postgres data store', async () => {
    const repo = await createRepository('postgres');
    expect(repo).toBeDefined();
    expect(repo.kos).toBeDefined();
  });
});
