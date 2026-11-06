import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DESTINATION_SEED } from './data/seed';
import { MockLlmProvider } from './providers/llm/MockLlmProvider';
import { createTestContext, login, type TestContext } from './test/helpers';

describe('AI Chatbot QA Accuracy Test Suite', () => {
  const llm = new MockLlmProvider();
  const destinations = DESTINATION_SEED;
  let ctx: TestContext;
  let tenantToken: string;

  beforeAll(async () => {
    ctx = await createTestContext();
    tenantToken = (await login(ctx, 'tenant@kosmatch.test')).token;
  });

  afterAll(async () => {
    await ctx.close();
  });

  const ask = (message: string) =>
    ctx.api.post('/api/chatbot').set('Authorization', `Bearer ${tenantToken}`).send({ message });

  describe('1. Destination Recognition Accuracy (All 11 Destinations & Aliases)', () => {
    const testCases: Array<{ query: string; expectedDestId: string; description: string }> = [
      {
        query: 'Cari kos dekat kampus UI Depok',
        expectedDestId: 'universitas-indonesia',
        description: 'Alias UI / Universitas Indonesia',
      },
      {
        query: 'Rekomendasi kos sekitar Binus Kemanggisan',
        expectedDestId: 'binus-kemanggisan',
        description: 'Alias Binus / Kemanggisan',
      },
      {
        query: 'Kos dekat Trisakti Grogol budget murah',
        expectedDestId: 'universitas-trisakti',
        description: 'Alias Trisakti / Grogol',
      },
      {
        query: 'Cari kosan dekat UNJ Rawamangun',
        expectedDestId: 'unj-rawamangun',
        description: 'Alias UNJ / Rawamangun',
      },
      {
        query: 'Info kos dekat kampus Atma Jaya Semanggi',
        expectedDestId: 'atma-jaya-semanggi',
        description: 'Alias Atma Jaya / Semanggi',
      },
      {
        query: 'Kos-kosan dekat kantor SCBD',
        expectedDestId: 'scbd',
        description: 'Alias SCBD',
      },
      {
        query: 'Kos di kawasan Sudirman Thamrin untuk pekerja',
        expectedDestId: 'sudirman-thamrin',
        description: 'Alias Sudirman / Thamrin',
      },
      {
        query: 'Cari tempat tinggal di area Kuningan Jakarta Selatan',
        expectedDestId: 'kuningan',
        description: 'Alias Kuningan',
      },
      {
        query: 'Kos jalan kaki ke Stasiun Sudirman',
        expectedDestId: 'stasiun-sudirman',
        description: 'Alias Stasiun Sudirman',
      },
      {
        query: 'Ada kos dekat stasiun tebet?',
        expectedDestId: 'stasiun-tebet',
        description: 'Alias Stasiun Tebet',
      },
      {
        query: 'Cari kos dekat Stasiun Palmerah',
        expectedDestId: 'stasiun-palmerah',
        description: 'Alias Stasiun Palmerah',
      },
    ];

    for (const tc of testCases) {
      it(`accurately resolves destination for: "${tc.query}" -> ${tc.expectedDestId} (${tc.description})`, async () => {
        const params = await llm.extractParams(tc.query, destinations);
        expect(params.destinationId).toBe(tc.expectedDestId);
      });
    }
  });

  describe('2. Budget Parsing & Price Range Accuracy', () => {
    it('accurately parses round million: "budget 2 juta" -> 2.000.000', async () => {
      const p = await llm.extractParams('budget 2 juta', destinations);
      expect(p.maxBudgetMonthly).toBe(2_000_000);
    });

    it('accurately parses decimal Indonesian format: "maksimal 2,5 jt" -> 2.500.000', async () => {
      const p = await llm.extractParams('maksimal 2,5 jt', destinations);
      expect(p.maxBudgetMonthly).toBe(2_500_000);
    });

    it('accurately parses alternative decimal format: "di bawah 1.8 juta" -> 1.800.000', async () => {
      const p = await llm.extractParams('di bawah 1.8 juta', destinations);
      expect(p.maxBudgetMonthly).toBe(1_800_000);
    });

    it('accurately parses thousands abbreviation: "harga 800rb" -> 800.000', async () => {
      const p = await llm.extractParams('harga 800rb', destinations);
      expect(p.maxBudgetMonthly).toBe(800_000);
    });

    it('accurately parses plain numeric digits: "budget 3000000" -> 3.000.000', async () => {
      const p = await llm.extractParams('budget 3000000', destinations);
      expect(p.maxBudgetMonthly).toBe(3_000_000);
    });

    it('accurately parses min and max price range: "range budget 1-2 juta" -> min 1jt, max 2jt', async () => {
      const p = await llm.extractParams('range budget 1-2 juta', destinations);
      expect(p.minBudgetMonthly).toBe(1_000_000);
      expect(p.maxBudgetMonthly).toBe(2_000_000);
    });
  });

  describe('3. Kos Type & Gender Filter Accuracy', () => {
    it('accurately detects "khusus putri" / "cewek" as tipe putri', async () => {
      expect((await llm.extractParams('kos khusus putri', destinations)).tipe).toBe('putri');
      expect((await llm.extractParams('kos cewek dekat binus', destinations)).tipe).toBe('putri');
      expect((await llm.extractParams('kos untuk perempuan', destinations)).tipe).toBe('putri');
    });

    it('accurately detects "khusus putra" / "cowok" as tipe putra', async () => {
      expect((await llm.extractParams('kos khusus putra', destinations)).tipe).toBe('putra');
      expect((await llm.extractParams('kos cowok di grogol', destinations)).tipe).toBe('putra');
      expect((await llm.extractParams('kosan laki-laki', destinations)).tipe).toBe('putra');
    });

    it('accurately detects "kos campur" as tipe campur', async () => {
      expect((await llm.extractParams('kos campur bebas', destinations)).tipe).toBe('campur');
    });
  });

  describe('4. Commute Constraint & Mode Extraction Accuracy', () => {
    it('accurately extracts ojek mode and max cost constraint: "ojek < 15rb"', async () => {
      const p = await llm.extractParams('kos dekat scbd, ojek < 15rb', destinations);
      expect(p.preferredMode).toBe('ojek');
      expect(p.maxCommuteCostRp).toBe(15_000);
    });

    it('accurately extracts duration constraint: "maksimal 20 menit"', async () => {
      const p = await llm.extractParams('kos dekat UI maksimal 20 menit', destinations);
      expect(p.maxCommuteMin).toBe(20);
    });

    it('accurately detects walking preference: "bisa jalan kaki"', async () => {
      const p = await llm.extractParams('kos yang bisa jalan kaki ke kampus', destinations);
      expect(p.preferredMode).toBe('jalan_kaki');
    });

    it('accurately detects transit/KRL preference: "naik krl ke sudirman"', async () => {
      const p = await llm.extractParams('naik krl ke sudirman', destinations);
      expect(p.preferredMode).toBe('transit');
    });
  });

  describe('5. Facility Extraction Accuracy', () => {
    it('accurately extracts "kamar mandi dalam" facility', async () => {
      const p = await llm.extractParams('kos dekat UI kamar mandi dalam', destinations);
      expect(p.fasilitas).toContain('Kamar Mandi Dalam');
    });

    it('accurately extracts "AC" and "WiFi" facilities', async () => {
      const p = await llm.extractParams('kos dengan ac dan wifi', destinations);
      expect(p.fasilitas).toEqual(expect.arrayContaining(['AC', 'WiFi']));
    });
  });

  describe('6. End-to-End Chatbot Response & Grounding Validation', () => {
    it('returns grounded recommendations strictly obeying budget and destination (UI, <= 2 juta)', async () => {
      const res = await ask('Cari kos dekat UI budget 2 juta');
      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.noResults).toBe(false);
      expect(data.params.destinationId).toBe('universitas-indonesia');
      expect(data.params.maxBudgetMonthly).toBe(2_000_000);
      expect(data.results.length).toBeGreaterThan(0);

      // Verify each returned kos strictly respects the max budget
      for (const item of data.results) {
        expect(item.kos.hargaSewa).toBeLessThanOrEqual(2_000_000);
        // Verify commute estimates are attached with mandatory estimate flag
        expect(item.commute.length).toBeGreaterThan(0);
        for (const c of item.commute) {
          expect(c.isEstimate).toBe(true);
          expect(c.source).toBe('mock');
        }
      }
    });

    it('returns grounded recommendations strictly obeying gender filter (Binus, putri)', async () => {
      const res = await ask('Cari kos putri dekat Binus budget 2.5 juta');
      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.noResults).toBe(false);
      expect(data.params.destinationId).toBe('binus-kemanggisan');
      expect(data.params.tipe).toBe('putri');

      for (const item of data.results) {
        expect(item.kos.tipe).toBe('putri');
        expect(item.kos.hargaSewa).toBeLessThanOrEqual(2_500_000);
      }
    });

    it('returns grounded recommendations strictly obeying putra filter (UNJ, putra)', async () => {
      const res = await ask('kos putra dekat UNJ budget 2 juta');
      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.noResults).toBe(false);
      expect(data.params.destinationId).toBe('unj-rawamangun');
      expect(data.params.tipe).toBe('putra');

      for (const item of data.results) {
        expect(item.kos.tipe).toBe('putra');
        expect(item.kos.hargaSewa).toBeLessThanOrEqual(2_000_000);
      }
    });

    it('returns polite clarification question for greeting queries without crashing', async () => {
      const res = await ask('halo selamat pagi kak');
      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.noResults).toBe(false);
      expect(data.results).toEqual([]);
      expect(data.reply).toMatch(/Mau ke kampus atau kantor mana|Silakan beri tahu/i);
    });

    it('applies fallback strategy gracefully for unrealistic budget without 0 results', async () => {
      const res = await ask('kos 50 ribu di SCBD');
      expect(res.status).toBe(200);
      const data = res.body.data;
      expect(data.isFallback).toBe(true);
      expect(data.fallbackReason).toBe('budget_terlalu_rendah');
      expect(data.results.length).toBeGreaterThan(0);
      expect(data.reply).toMatch(/tidak menemukan|budget|alternatif/i);
    });

    it('strictly isolates out-of-scope requests in schema extraction', async () => {
      const params = await llm.extractParams('kos dekat UI ada bioskop pribadi, helipad, dan PS5 budget 2 jt', destinations);
      expect(params.destinationId).toBe('universitas-indonesia');
      expect(params.maxBudgetMonthly).toBe(2_000_000);
      expect(params.unsupportedRequests).toContain('Bioskop Pribadi');
      expect(params.unsupportedRequests).toContain('Helipad');
      expect(params.unsupportedRequests).toContain('PS5');
      // Must not be added to standard fasilitas
      expect(params.fasilitas?.includes('Bioskop Pribadi')).toBeFalsy();
      expect(params.fasilitas?.includes('Helipad')).toBeFalsy();
      expect(params.fasilitas?.includes('PS5')).toBeFalsy();
    });
  });
});
