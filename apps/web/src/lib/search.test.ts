import { describe, expect, it } from 'vitest';
import { FACILITY_FILTER_OPTIONS, getPaginationPages, kosHasFilteredFacility } from './search';

describe('search helpers', () => {
  it('has valid facility filter options', () => {
    expect(FACILITY_FILTER_OPTIONS.length).toBeGreaterThan(5);
    expect(FACILITY_FILTER_OPTIONS.some((f) => f.id === 'ac')).toBe(true);
    expect(FACILITY_FILTER_OPTIONS.some((f) => f.id === 'km_dalam')).toBe(true);
    expect(FACILITY_FILTER_OPTIONS.some((f) => f.id === 'wifi')).toBe(true);
  });

  it('matches facilities accurately', () => {
    const kosSample = {
      fasilitas: ['AC', 'WiFi', 'K. Mandi Dalam', 'Kasur'],
      deskripsi: 'Kos nyaman ber-AC dan dekat kampus.',
    };

    expect(kosHasFilteredFacility(kosSample, 'ac')).toBe(true);
    expect(kosHasFilteredFacility(kosSample, 'wifi')).toBe(true);
    expect(kosHasFilteredFacility(kosSample, 'km_dalam')).toBe(true);
    expect(kosHasFilteredFacility(kosSample, 'kasur')).toBe(true);
    expect(kosHasFilteredFacility(kosSample, 'km_luar')).toBe(false);
    expect(kosHasFilteredFacility(kosSample, 'parkir_mobil')).toBe(false);
  });

  it('computes pagination page numbers correctly', () => {
    expect(getPaginationPages(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPaginationPages(1, 10)).toEqual([1, 2, 3, 4, 5, '...', 10]);
    expect(getPaginationPages(5, 10)).toEqual([1, '...', 4, 5, 6, '...', 10]);
    expect(getPaginationPages(9, 10)).toEqual([1, '...', 6, 7, 8, 9, 10]);
  });
});
