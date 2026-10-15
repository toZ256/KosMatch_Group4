import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, login, type TestContext } from './test/helpers';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestContext();
});
afterAll(async () => {
  await ctx.close();
});

const validKos = {
  namaKos: 'Kos Baru Uji',
  area: 'Menteng',
  hargaSewa: 2100000,
  latitude: -6.2,
  longitude: 106.8,
  tipe: 'campur',
  fasilitas: ['AC', 'WiFi'],
  deskripsi: 'Kos baru yang bersih dan nyaman.',
};

describe('health & public data', () => {
  it('returns health in the envelope', async () => {
    const res = await ctx.api.get('/api/health');
    expect(res.body).toEqual({ ok: true, data: { status: 'ok', mode: { ai: 'mock', data: 'memory' } } });
  });

  it('lists destinations, kos with filters, and commute', async () => {
    const dests = await ctx.api.get('/api/destinations');
    expect(dests.body.data).toHaveLength(11);
    const kos = await ctx.api.get('/api/kos').query({ maxPrice: 2000000, tipe: 'putra' });
    expect(kos.body.data.length).toBeGreaterThan(0);
    for (const k of kos.body.data) expect(k.hargaSewa).toBeLessThanOrEqual(2000000);
    const withCommute = await ctx.api.get('/api/kos').query({ destinationId: 'scbd' });
    expect(withCommute.body.data[0].commute[0]).toMatchObject({ isEstimate: true, source: 'mock' });
    const first = withCommute.body.data[0];
    const detail = await ctx.api.get(`/api/kos/${first.id}`).query({ destinationId: 'scbd' });
    expect(detail.body.data.commute.length).toBeGreaterThan(0);
    const commute = await ctx.api.get('/api/commute').query({ kosId: first.id, destinationId: 'scbd' });
    expect(commute.body.data[0].source).toBe('mock');
    expect((await ctx.api.get('/api/kos/nope')).status).toBe(404);
    expect((await ctx.api.get('/api/kos').query({ tipe: 'x' })).status).toBe(400);
  });

  it('returns NOT_FOUND envelope for unknown api routes', async () => {
    const res = await ctx.api.get('/api/unknown');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('auth', () => {
  it('registers, logs in and reads me without leaking passwordHash', async () => {
    const reg = await ctx.api
      .post('/api/auth/register')
      .send({ nama: 'Uji Coba', email: 'Uji@Test.id', password: 'rahasia123', role: 'tenant' });
    expect(reg.status).toBe(201);
    expect(reg.body.data.user.passwordHash).toBeUndefined();

    const dup = await ctx.api
      .post('/api/auth/register')
      .send({ nama: 'Uji Coba', email: 'uji@test.id', password: 'rahasia123', role: 'tenant' });
    expect(dup.status).toBe(400);

    const log = await ctx.api.post('/api/auth/login').send({ email: 'uji@test.id', password: 'rahasia123' });
    expect(log.status).toBe(200);
    const me = await ctx.api.get('/api/auth/me').set('Authorization', `Bearer ${log.body.data.token}`);
    expect(me.body.data.email).toBe('uji@test.id');
    expect(JSON.stringify(me.body)).not.toContain('passwordHash');
  });

  it('rejects wrong credentials and invalid input', async () => {
    const bad = await ctx.api.post('/api/auth/login').send({ email: 'tenant@kosmatch.test', password: 'salah' });
    expect(bad.status).toBe(401);
    const invalid = await ctx.api.post('/api/auth/register').send({ nama: 'x' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 without or with a bad token', async () => {
    expect((await ctx.api.get('/api/auth/me')).status).toBe(401);
    expect((await ctx.api.get('/api/bookmarks')).status).toBe(401);
    expect((await ctx.api.get('/api/auth/me').set('Authorization', 'Bearer abc')).status).toBe(401);
  });
});

describe('owner kos', () => {
  it('returns 403 for tenant on owner routes', async () => {
    const { token } = await login(ctx, 'tenant@kosmatch.test');
    const res = await ctx.api.get('/api/owner/kos').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('lets an owner create, update and delete own kos but not others', async () => {
    const owner = await login(ctx, 'owner@kosmatch.test');
    const owner2 = await login(ctx, 'owner2@kosmatch.test');
    const auth = { Authorization: `Bearer ${owner.token}` };

    const list = await ctx.api.get('/api/owner/kos').set(auth);
    expect(list.body.data.every((k: { ownerId: string }) => k.ownerId === owner.id)).toBe(true);

    expect((await ctx.api.post('/api/owner/kos').set(auth).send({ ...validKos, hargaSewa: 10 })).status).toBe(400);
    const created = await ctx.api.post('/api/owner/kos').set(auth).send(validKos);
    expect(created.status).toBe(201);
    const id = created.body.data.id as string;

    const updated = await ctx.api.put(`/api/owner/kos/${id}`).set(auth).send({ ...validKos, hargaSewa: 2300000 });
    expect(updated.body.data.hargaSewa).toBe(2300000);

    const forbidden = await ctx.api
      .put(`/api/owner/kos/${id}`)
      .set('Authorization', `Bearer ${owner2.token}`)
      .send(validKos);
    expect(forbidden.status).toBe(403);

    expect((await ctx.api.delete(`/api/owner/kos/${id}`).set(auth)).status).toBe(200);
    expect((await ctx.api.delete(`/api/owner/kos/${id}`).set(auth)).status).toBe(404);
  });
});
