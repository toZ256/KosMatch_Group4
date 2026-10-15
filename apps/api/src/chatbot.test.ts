import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, login, type TestContext } from './test/helpers';

let ctx: TestContext;
let tenantToken: string;
beforeAll(async () => {
  ctx = await createTestContext();
  tenantToken = (await login(ctx, 'tenant@kosmatch.test')).token;
});
afterAll(async () => {
  await ctx.close();
});

const ask = (message: string, token = tenantToken) =>
  ctx.api.post('/api/chatbot').set('Authorization', `Bearer ${token}`).send({ message });

describe('POST /api/chatbot', () => {
  it('requires login and tenant role', async () => {
    expect((await ctx.api.post('/api/chatbot').send({ message: 'x' })).status).toBe(401);
    const owner = await login(ctx, 'owner@kosmatch.test');
    expect((await ask('x', owner.token)).status).toBe(403);
    expect((await ask('')).status).toBe(400);
  });

  it('returns results with commute estimates (Kos Andalan UI for UI + 2 juta)', async () => {
    const res = await ask('Cari kos dekat UI budget 2 juta');
    const data = res.body.data;
    expect(data.noResults).toBe(false);
    const names = data.results.map((r: { kos: { namaKos: string } }) => r.kos.namaKos);
    expect(names).toContain('Kos Andalan UI');
    expect(data.results[0].commute[0]).toMatchObject({ isEstimate: true, source: 'mock' });
    expect(data.results.length).toBeLessThanOrEqual(5);
  });

  it('filters ojek cost <= 15000 near Stasiun Sudirman', async () => {
    const res = await ask('kos dekat stasiun sudirman, ojek < 15rb');
    const { results, params } = res.body.data;
    expect(params).toMatchObject({ destinationId: 'stasiun-sudirman', maxCommuteCostRp: 15000 });
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r.commute.every((c: { mode: string; costRp: number }) => c.mode === 'ojek' && c.costRp <= 15000)).toBe(true);
    }
  });

  it('asks for clarification instead of failing on "halo"', async () => {
    const res = await ask('halo');
    expect(res.status).toBe(200);
    expect(res.body.data.noResults).toBe(false);
    expect(res.body.data.results).toEqual([]);
    expect(res.body.data.reply).toContain('Mau ke kampus atau kantor mana');
  });

  it('reports noResults when nothing matches', async () => {
    const res = await ask('kos 100 ribu di Depok');
    expect(res.status).toBe(200);
    expect(res.body.data.noResults).toBe(true);
    expect(res.body.data.results).toEqual([]);
  });
});
