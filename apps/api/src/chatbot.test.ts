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

  it('provides fallback recommendations instead of empty results when criteria are too strict', async () => {
    const res = await ask('kos 100 ribu di Depok');
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.isFallback).toBe(true);
    expect(data.fallbackReason).toBe('budget_terlalu_rendah');
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.reply).toMatch(/tidak menemukan|budget|alternatif/i);
  });

  it('isolates out-of-scope requests (e.g. helipad, PS5) without breaking the query', async () => {
    const res = await ask('cari kos dekat stasiun sudirman yang ada helipad dan PS5 budget 3 juta');
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.params.destinationId).toBe('stasiun-sudirman');
    expect(data.params.unsupportedRequests).toBeDefined();
    expect(data.params.unsupportedRequests).toContain('Helipad');
    expect(data.params.unsupportedRequests).toContain('PS5');
    // Ensure unsupported requests were not leaked into facilities filter
    expect(data.params.fasilitas?.includes('Helipad')).toBeFalsy();
    expect(data.params.fasilitas?.includes('PS5')).toBeFalsy();
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.reply).toMatch(/helipad|ps5|tidak tersedia/i);
  });

  it('accurately handles query with non-standard environment feature like pemancingan', async () => {
    const res = await ask('saya ingin mencari kos sekitar ui yang memiliki pemancingan di dekatnya serta memiliki ac dan kamar mandi dalam dengan budget maksimal 1,5 juta per bulan');
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.params.destinationId).toBe('universitas-indonesia');
    expect(data.params.maxBudgetMonthly).toBe(1_500_000);
    expect(data.params.unsupportedRequests).toContain('Pemancingan');
    expect(data.params.fasilitas).toContain('AC');
    expect(data.params.fasilitas).toContain('Kamar Mandi Dalam');
    expect(data.params.fasilitas?.includes('Pemancingan')).toBeFalsy();
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.reply).toMatch(/pemancingan/i);
  });

  it('accurately resolves area keyword and unsupported POI destination (e.g. rumah sakit di tambun)', async () => {
    const res = await ask('saya mau kos yang dekat dengan rumah sakit di tambun');
    expect(res.status).toBe(200);
    const data = res.body.data;
    // Destination is not in standard 11 catalog, so destinationId is undefined
    expect(data.params.destinationId).toBeUndefined();
    // Area "Tambun" must be recognized
    expect(data.params.areaKeywords).toContain('Tambun');
    // "Rumah Sakit" must be isolated as unsupported destination POI
    expect(data.params.unsupportedRequests).toContain('Titik Rumah Sakit');
    // Zero empty screen: returns results (in memory test seed returns fallback alternatives)
    expect(data.results.length).toBeGreaterThan(0);
    // Reply must explain unsupported POI and mention the area matches without sounding like a generic greeting
    expect(data.reply).not.toBe('Mau ke kampus atau kantor mana, dan berapa budget sewa per bulan?');
    expect(data.reply).toMatch(/rumah sakit|tambun/i);
  });

  it('matches kos in area when area is in database (e.g. rumah sakit di depok)', async () => {
    const res = await ask('cari kos dekat rumah sakit di depok');
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.params.areaKeywords).toContain('Depok');
    expect(data.params.unsupportedRequests).toContain('Titik Rumah Sakit');
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results.some((r: { kos: { area: string } }) => /depok/i.test(r.kos.area))).toBe(true);
    expect(data.reply).toMatch(/rumah sakit|depok/i);
  });

  it('simply and honestly reports non-catalog destination (Paramadina) and isolates meja biliar', async () => {
    const res = await ask('sy mw kos yg dkt kampus paramadina terus punya meja biliar ama kamar mandi dalem');
    expect(res.status).toBe(200);
    const data = res.body.data;
    // 1. Destination ID must be undefined (not in 11 catalog)
    expect(data.params.destinationId).toBeUndefined();
    // 2. Meja Biliar and Kampus Paramadina isolated in unsupportedRequests
    expect(data.params.unsupportedRequests).toContain('Meja Biliar');
    expect(data.params.unsupportedRequests).toContain('Kampus Paramadina');
    // 3. Meja study desk must NOT be falsely extracted
    expect(data.params.fasilitas?.includes('Meja')).toBeFalsy();
    // 4. Kamar Mandi Dalam must be extracted
    expect(data.params.fasilitas).toContain('Kamar Mandi Dalam');
    // 5. Zero random guessing: results is [] because the campus is unregistered and no Jabodetabek area was provided
    expect(data.results).toEqual([]);
    // 6. Reply acknowledges Paramadina and Meja Biliar honestly
    expect(data.reply).toMatch(/paramadina/i);
    expect(data.reply).toMatch(/meja biliar/i);
    expect(data.reply).not.toBe('Mau ke kampus atau kantor mana, dan berapa budget sewa per bulan?');
  });

  it('simply and honestly reports non-catalog campus (ITB) and massage chair without random results', async () => {
    const res = await ask('sy mw kos dkt itb yg punya kursi pijet');
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.params.destinationId).toBeUndefined();
    expect(data.params.unsupportedRequests).toContain('Kampus ITB');
    expect(data.params.unsupportedRequests).toContain('Kursi Pijat');
    expect(data.results).toEqual([]);
    expect(data.reply).toMatch(/itb/i);
    expect(data.reply).toMatch(/kursi pijat/i);
    expect(data.reply).not.toBe('Mau ke kampus atau kantor mana, dan berapa budget sewa per bulan?');
  });

  it('accurately isolates meja makan from study desk while retrieving valid destination (Binus)', async () => {
    const res = await ask('skrg saya mau yg dkt binus tapi punya meja makan');
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.params.destinationId).toBe('binus-kemanggisan');
    expect(data.params.unsupportedRequests).toContain('Meja Makan');
    expect(data.params.fasilitas?.includes('Meja')).toBeFalsy();
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.reply).toMatch(/binus/i);
    expect(data.reply).toMatch(/meja makan/i);
  });

  it('accurately parses colloquial budget range like 900 rb ampe 1,5 juta', async () => {
    const res = await ask('coba kos deket trisakti harga 900 rb ampe 1,5 juta yg punya meja makan');
    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.params.destinationId).toBe('universitas-trisakti');
    expect(data.params.minBudgetMonthly).toBe(900_000);
    expect(data.params.maxBudgetMonthly).toBe(1_500_000);
    expect(data.params.unsupportedRequests).toContain('Meja Makan');
    expect(data.results.length).toBeGreaterThan(0);
  });
});
