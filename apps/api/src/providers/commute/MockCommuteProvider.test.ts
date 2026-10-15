import { describe, expect, it } from 'vitest';
import type { Destination, Kos } from '@kosmatch/shared';
import { MockCommuteProvider, haversineKm } from './MockCommuteProvider';
import { createCommuteProvider } from './index';

const provider = new MockCommuteProvider();
const kosAt = (latitude: number, longitude: number): Kos => ({
  id: 'k',
  ownerId: 'o',
  namaKos: 'K',
  hargaSewa: 1,
  latitude,
  longitude,
  area: 'A',
  tipe: 'campur',
  fasilitas: [],
  deskripsi: '',
  rating: 4,
  fotoColor: '#fff',
});
const dest = (latitude: number, longitude: number): Destination => ({
  id: 'd',
  nama: 'D',
  kategori: 'kampus',
  latitude,
  longitude,
  aliases: [],
});

describe('MockCommuteProvider', () => {
  it('computes haversine distance (~1 degree latitude = 111 km)', () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.19, 1);
  });

  it('is deterministic and always marked as estimate/mock', async () => {
    const a = await provider.estimate(kosAt(-6.23, 106.83), dest(-6.2, 106.82));
    const b = await provider.estimate(kosAt(-6.23, 106.83), dest(-6.2, 106.82));
    expect(a).toEqual(b);
    for (const e of a) expect(e).toMatchObject({ isEstimate: true, source: 'mock', destinationId: 'd' });
  });

  it('applies ojek minimum fare and rounding', async () => {
    const [ojek] = await provider.estimate(kosAt(-6.2, 106.8), dest(-6.2, 106.801), 'ojek');
    expect(ojek?.costRp).toBe(8000);
    const far = await provider.estimate(kosAt(-6.2, 106.8), dest(-6.2, 106.9), 'ojek');
    expect(far[0]!.costRp % 500).toBe(0);
    expect(far[0]!.costRp).toBeGreaterThan(8000);
  });

  it('caps transit fare at 10000 and counts transfers by distance', async () => {
    const near = (await provider.estimate(kosAt(-6.2, 106.8), dest(-6.2, 106.82), 'transit'))[0]!;
    expect(near.transitTransfers).toBe(0);
    const mid = (await provider.estimate(kosAt(-6.2, 106.8), dest(-6.2, 106.9), 'transit'))[0]!;
    expect(mid.transitTransfers).toBe(1);
    const far = (await provider.estimate(kosAt(-6.2, 106.8), dest(-6.2, 107.2), 'transit'))[0]!;
    expect(far.transitTransfers).toBe(2);
    expect(far.costRp).toBe(10000);
    expect(mid.durationMin).toBeGreaterThanOrEqual(10);
  });

  it('only returns walking when distance <= 1.5 km', async () => {
    const close = await provider.estimate(kosAt(-6.2, 106.8), dest(-6.2, 106.805));
    expect(close.map((e) => e.mode)).toEqual(['ojek', 'transit', 'jalan_kaki']);
    expect(close[2]).toMatchObject({ costRp: 0, transitTransfers: 0 });
    const far = await provider.estimate(kosAt(-6.2, 106.8), dest(-6.3, 106.9));
    expect(far.map((e) => e.mode)).toEqual(['ojek', 'transit']);
    expect(await provider.estimate(kosAt(-6.2, 106.8), dest(-6.3, 106.9), 'jalan_kaki')).toEqual([]);
  });

  it('computes duration with ceil (ojek 11 km road distance ~ 30 min)', async () => {
    // distance 11.0 km => 11/22*60 = 30 exactly
    const e = (await provider.estimate(kosAt(0, 0), dest(0, 0.0762), 'ojek'))[0]!;
    expect(e.durationMin).toBe(Math.ceil((e.distanceKm / 22) * 60 - 1e-9));
  });

  it('factory rejects non-mock', () => {
    expect(() => createCommuteProvider(false)).toThrow('Provider belum diimplementasikan');
  });
});
