import { describe, expect, it, vi } from 'vitest';
import {
  matchKosToLocation,
  resolveLocationQuery,
  type Destination,
  type Kos,
} from '@kosmatch/shared';
import { MockCommuteProvider, haversineKm } from './MockCommuteProvider';
import { NominatimGeocoder } from './NominatimGeocoder';
import { OsrmCommuteProvider } from './OsrmCommuteProvider';
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

  it('factory creates OsrmCommuteProvider and rejects unsupported providers', () => {
    expect(createCommuteProvider(false)).toBeInstanceOf(OsrmCommuteProvider);
    expect(createCommuteProvider('osrm')).toBeInstanceOf(OsrmCommuteProvider);
    expect(() => createCommuteProvider('google')).toThrow('Provider belum diimplementasikan');
  });
});

describe('OsrmCommuteProvider', () => {
  it('computes commute estimates from OSRM driving route and caches repeated calls', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [{ distance: 4200, duration: 900 }], // 4.2 km, 15 min driving
      }),
    });
    const osrm = new OsrmCommuteProvider({ fetchFn: mockFetch as unknown as typeof fetch });
    const first = await osrm.estimate(kosAt(-6.36, 106.82), dest(-6.365, 106.83));
    const second = await osrm.estimate(kosAt(-6.36, 106.82), dest(-6.365, 106.83));
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(first[0]).toMatchObject({
      mode: 'ojek',
      distanceKm: 4.2,
      durationMin: 13, // ceil(15 * 0.85) = 13
      costRp: 12500,
      isEstimate: true,
      source: 'mock',
    });
  });

  it('falls back to MockCommuteProvider when OSRM fails or is offline', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('network offline'));
    const osrm = new OsrmCommuteProvider({ fetchFn: mockFetch as unknown as typeof fetch });
    const res = await osrm.estimate(kosAt(-6.23, 106.83), dest(-6.2, 106.82));
    const expected = await provider.estimate(kosAt(-6.23, 106.83), dest(-6.2, 106.82));
    expect(res).toEqual(expected);
  });
});

describe('Location Gazetteer & NominatimGeocoder (OpenStreetMap)', () => {
  it('resolves TB Simatupang corridor with surrounding sub-areas and radius', () => {
    const loc = resolveLocationQuery('TB Simatupang');
    expect(loc).not.toBeNull();
    expect(loc!.displayName).toContain('TB Simatupang');
    expect(loc!.nearbyAreas).toEqual(
      expect.arrayContaining(['Cilandak', 'Pasar Minggu', 'Fatmawati', 'Lebak Bulus', 'Jagakarsa']),
    );

    // Matches kos in surrounding district (Cilandak) even if "Simatupang" is not in namaKos
    const kosCilandak = {
      ...kosAt(-6.29, 106.8),
      namaKos: 'Kost Tipe D Cilandak Jakarta Selatan',
      area: 'Cilandak, Jakarta Selatan',
    };
    const matchRes = matchKosToLocation(kosCilandak, loc!);
    expect(matchRes.matches).toBe(true);
    expect(matchRes.isNearbyAreaMatch).toBe(true);
    expect(matchRes.isWithinRadius).toBe(true);
  });

  it('resolves dynamic Jakarta locations via OpenStreetMap Nominatim when not in local Gazetteer', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          place_id: 123,
          lat: '-6.288',
          lon: '106.809',
          name: 'Cilandak Town Square',
          address: {
            suburb: 'Cilandak Barat',
            city_district: 'Cilandak',
            city: 'Jakarta Selatan',
          },
        },
      ],
    });

    const geocoder = new NominatimGeocoder({
      fetchFn: mockFetch as unknown as typeof fetch,
      enableNetwork: true,
    });

    const resolved = await geocoder.resolve('Menara 165 Jakarta');
    expect(resolved).not.toBeNull();
    expect(resolved!.latitude).toBeCloseTo(-6.288, 3);
    expect(resolved!.nearbyAreas).toEqual(expect.arrayContaining(['Cilandak', 'Cilandak Barat']));
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('searches arbitrary Greater Jakarta buildings via Photon and filters out-of-region hits', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        features: [
          {
            geometry: { coordinates: [106.7975, -6.2271] },
            properties: {
              osm_id: 101,
              name: 'Senayan City',
              street: 'Jalan Asia Afrika',
              district: 'Tanah Abang',
              city: 'Jakarta Pusat',
            },
          },
          {
            geometry: { coordinates: [110.3695, -7.7956] }, // Yogyakarta (outside Jabodetabek)
            properties: {
              osm_id: 102,
              name: 'Malioboro Mall',
              city: 'Yogyakarta',
            },
          },
        ],
      }),
    });

    const geocoder = new NominatimGeocoder({
      fetchFn: mockFetch as unknown as typeof fetch,
      enableNetwork: true,
    });

    const places = await geocoder.searchPlaces('Senayan City', 5);
    expect(places).toHaveLength(1);
    expect(places[0]).toMatchObject({
      label: 'Senayan City',
      category: 'tempat',
      latitude: -6.2271,
      longitude: 106.7975,
    });
    // Cached on second call
    await geocoder.searchPlaces('senayan city', 5);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
