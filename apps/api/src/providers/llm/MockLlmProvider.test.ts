import { describe, expect, it } from 'vitest';
import { DESTINATION_SEED } from '../../data/seed';
import { MockLlmProvider } from './MockLlmProvider';
import { createLlmProvider } from './index';
import { ChatParamsSchema } from '@kosmatch/shared';

const llm = new MockLlmProvider();
const dests = DESTINATION_SEED;
const parse = (m: string) => llm.extractParams(m, dests);

describe('MockLlmProvider.extractParams', () => {
  it('parses "2 juta" as monthly budget', async () => {
    expect((await parse('budget 2 juta')).maxBudgetMonthly).toBe(2_000_000);
  });
  it('parses decimal "2,5 jt"', async () => {
    expect((await parse('maksimal 2,5 jt')).maxBudgetMonthly).toBe(2_500_000);
  });
  it('parses "800rb" as rent (>= 500.000)', async () => {
    expect((await parse('kos 800rb')).maxBudgetMonthly).toBe(800_000);
  });
  it('parses "ojek < 15rb" as commute cost + ojek mode', async () => {
    const p = await parse('kos dekat stasiun sudirman, ojek < 15rb');
    expect(p).toEqual({ destinationId: 'stasiun-sudirman', maxCommuteCostRp: 15000, preferredMode: 'ojek' });
  });
  it('parses cost keyword after number', async () => {
    expect((await parse('ongkos 10k saja')).maxCommuteCostRp).toBe(10_000);
  });
  it('parses commute time in minutes', async () => {
    const p = await parse('maksimal 30 menit ke kampus ui');
    expect(p.maxCommuteMin).toBe(30);
    expect(p.maxBudgetMonthly).toBeUndefined();
  });
  it('matches the longest alias', async () => {
    expect((await parse('dekat stasiun sudirman')).destinationId).toBe('stasiun-sudirman');
    expect((await parse('daerah sudirman')).destinationId).toBe('sudirman-thamrin');
  });
  it('matches aliases case-insensitively and not inside other words', async () => {
    expect((await parse('Cari kos dekat UI')).destinationId).toBe('universitas-indonesia');
    expect((await parse('kos quiet nyaman')).destinationId).toBeUndefined();
  });
  it('detects tipe', async () => {
    expect((await parse('kos cowok')).tipe).toBe('putra');
    expect((await parse('kos untuk perempuan')).tipe).toBe('putri');
  });
  it('detects transport mode', async () => {
    expect((await parse('naik krl')).preferredMode).toBe('transit');
    expect((await parse('bisa jalan kaki')).preferredMode).toBe('jalan_kaki');
  });
  it('returns empty params for empty or meaningless input', async () => {
    expect(await parse('')).toEqual({});
    expect(await parse('halo')).toEqual({});
  });
  it('parses plain big numbers and treats small unit amounts without keyword as rent', async () => {
    expect((await parse('budget 3000000')).maxBudgetMonthly).toBe(3_000_000);
    expect((await parse('kos 100 ribu di Depok')).maxBudgetMonthly).toBe(100_000);
  });
  it('always produces output that passes ChatParamsSchema', async () => {
    for (const m of ['halo', 'ui 2 juta 30 menit ojek 10rb cewek', '999999999 juta']) {
      expect(ChatParamsSchema.safeParse(await parse(m)).success).toBe(true);
    }
  });
});

describe('MockLlmProvider.composeReply', () => {
  it('asks for clarification without destination and budget', async () => {
    expect(await llm.composeReply({}, 0)).toContain('Mau ke kampus atau kantor mana');
  });
  it('mentions count and the estimate disclaimer', async () => {
    expect(await llm.composeReply({ maxBudgetMonthly: 3_000_000 }, 3)).toMatch(/3 kos.*Estimasi/);
  });
});

describe('provider factory', () => {
  it('throws for non-mock providers', () => {
    expect(() => createLlmProvider(false)).toThrow('Provider belum diimplementasikan');
  });
});
