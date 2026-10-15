import { describe, expect, it } from 'vitest';
import { formatRupiah, initials } from './format';

describe('format helpers', () => {
  it('formats rupiah with dots', () => {
    expect(formatRupiah(1800000)).toBe('Rp 1.800.000');
    expect(formatRupiah(8000)).toBe('Rp 8.000');
  });
  it('builds initials', () => {
    expect(initials('Bu Sari (Pemilik)')).toBe('BS');
    expect(initials('Demo Penyewa')).toBe('DP');
  });
});
