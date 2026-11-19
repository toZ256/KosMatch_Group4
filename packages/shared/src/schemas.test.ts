import { describe, expect, it } from 'vitest';
import {
  ChatParamsSchema,
  KosFormSchema,
  SendMessageInputSchema,
  extractCoordsFromGoogleMapsUrl,
  isValidGoogleMapsUrl,
} from './schemas';

describe('shared schemas', () => {
  it('coerces numeric strings in KosFormSchema', () => {
    const parsed = KosFormSchema.parse({
      namaKos: 'Kos Uji',
      area: 'Tebet',
      hargaSewa: '2000000',
      latitude: '-6.2',
      longitude: '106.8',
      tipe: 'putra',
      fasilitas: ['AC'],
      deskripsi: 'Deskripsi cukup panjang',
    });
    expect(parsed.hargaSewa).toBe(2000000);
    expect(parsed.googleMapsUrl).toBeUndefined();
  });

  it('validates Google Maps share URLs and normalizes empty strings in KosFormSchema', () => {
    const base = {
      namaKos: 'Kos Melati',
      area: 'Kemang',
      hargaSewa: 1800000,
      latitude: -6.2607,
      longitude: 106.8133,
      tipe: 'putri',
      fasilitas: ['AC', 'WiFi'],
      deskripsi: 'Kos nyaman di area Kemang Selatan',
    };

    const withShortLink = KosFormSchema.parse({
      ...base,
      googleMapsUrl: 'https://maps.app.goo.gl/abc123XYZ',
    });
    expect(withShortLink.googleMapsUrl).toBe('https://maps.app.goo.gl/abc123XYZ');

    const withBlankLink = KosFormSchema.parse({ ...base, googleMapsUrl: '   ' });
    expect(withBlankLink.googleMapsUrl).toBeUndefined();

    expect(
      KosFormSchema.safeParse({ ...base, googleMapsUrl: 'https://example.com/not-maps' }).success,
    ).toBe(false);
    expect(isValidGoogleMapsUrl('https://goo.gl/maps/xyz123')).toBe(true);
    expect(isValidGoogleMapsUrl('https://www.google.com/maps/place/Kemang/@-6.2607,106.8133,17z')).toBe(true);
    expect(isValidGoogleMapsUrl('javascript:alert(1)')).toBe(false);
  });

  it('extracts coordinates from full Google Maps URLs', () => {
    expect(
      extractCoordsFromGoogleMapsUrl('https://www.google.com/maps/place/Kos/@-6.260712,106.813345,17z'),
    ).toEqual({ latitude: -6.260712, longitude: 106.813345 });
    expect(
      extractCoordsFromGoogleMapsUrl('https://maps.google.com/?q=-6.2921,106.8123'),
    ).toEqual({ latitude: -6.2921, longitude: 106.8123 });
    expect(
      extractCoordsFromGoogleMapsUrl('https://www.google.com/maps/place/X/data=!3d-6.2211!4d106.8422'),
    ).toEqual({ latitude: -6.2211, longitude: 106.8422 });
    expect(extractCoordsFromGoogleMapsUrl('https://maps.app.goo.gl/abc123')).toBeNull();
  });

  it('rejects empty and oversized messages', () => {
    expect(SendMessageInputSchema.safeParse({ pesan: '  ' }).success).toBe(false);
    expect(SendMessageInputSchema.safeParse({ pesan: 'a'.repeat(1001) }).success).toBe(false);
  });

  it('rejects unknown modes in ChatParamsSchema', () => {
    expect(ChatParamsSchema.safeParse({ preferredMode: 'helikopter' }).success).toBe(false);
  });
});
