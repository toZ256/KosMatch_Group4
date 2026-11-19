import { describe, expect, it } from 'vitest';
import type { Kos } from '@kosmatch/shared';
import {
  DEFAULT_JAKARTA_LAT,
  DEFAULT_JAKARTA_LNG,
  computePortfolioMetrics,
  evaluateListingReadiness,
  isDefaultCoordinate,
} from './owner';

const sampleKos = (overrides: Partial<Kos> = {}): Kos => ({
  id: 'kos-1',
  ownerId: 'owner-1',
  namaKos: 'Kos Melati Kemang',
  hargaSewa: 1800000,
  latitude: -6.2607,
  longitude: 106.8133,
  area: 'Kemang, Jakarta Selatan',
  tipe: 'putri',
  fasilitas: ['AC', 'WiFi', 'Kamar Mandi Dalam'],
  deskripsi: 'Kos putri nyaman dan bersih di kawasan Kemang, dekat halte dan pusat kuliner.',
  rating: 4.8,
  fotoColor: '#76ABAE',
  ...overrides,
});

describe('owner helpers', () => {
  it('detects default Monas coordinates accurately', () => {
    expect(isDefaultCoordinate(DEFAULT_JAKARTA_LAT, DEFAULT_JAKARTA_LNG)).toBe(true);
    expect(isDefaultCoordinate(-6.2607, 106.8133)).toBe(false);
  });

  it('scores a complete listing as 100% Siap Tayang', () => {
    const res = evaluateListingReadiness(sampleKos());
    expect(res.score).toBe(100);
    expect(res.label).toBe('Siap Tayang');
    expect(res.isDefaultCoords).toBe(false);
  });

  it('flags default coordinates and sparse details as Perlu Dilengkapi', () => {
    const res = evaluateListingReadiness(
      sampleKos({
        latitude: DEFAULT_JAKARTA_LAT,
        longitude: DEFAULT_JAKARTA_LNG,
        fasilitas: ['WiFi'],
        deskripsi: 'Kos murah meriah.',
      }),
    );
    expect(res.score).toBe(40);
    expect(res.label).toBe('Perlu Dilengkapi');
    expect(res.isDefaultCoords).toBe(true);
  });

  it('marks location ready when a valid Google Maps share link is provided', () => {
    const res = evaluateListingReadiness(
      sampleKos({
        latitude: DEFAULT_JAKARTA_LAT,
        longitude: DEFAULT_JAKARTA_LNG,
        googleMapsUrl: 'https://maps.app.goo.gl/testPin123',
      }),
    );
    expect(res.score).toBe(100);
    expect(res.checks.find((c) => c.id === 'lokasi')?.done).toBe(true);
  });

  it('aggregates portfolio metrics correctly', () => {
    const metrics = computePortfolioMetrics([
      sampleKos({ id: 'k1', tipe: 'putri', hargaSewa: 1500000, rating: 4.6 }),
      sampleKos({
        id: 'k2',
        tipe: 'putra',
        hargaSewa: 2500000,
        rating: 4.8,
        latitude: DEFAULT_JAKARTA_LAT,
        longitude: DEFAULT_JAKARTA_LNG,
        fasilitas: ['WiFi'],
        deskripsi: 'Singkat saja.',
      }),
    ]);

    expect(metrics.total).toBe(2);
    expect(metrics.byType).toEqual({ putra: 1, putri: 1, campur: 0 });
    expect(metrics.minPrice).toBe(1500000);
    expect(metrics.maxPrice).toBe(2500000);
    expect(metrics.avgPrice).toBe(2000000);
    expect(metrics.avgRating).toBe(4.7);
    expect(metrics.readyCount).toBe(1);
    expect(metrics.needsAttention).toHaveLength(1);
    expect(metrics.needsAttention[0]?.kos.id).toBe('k2');
  });
});
