import { describe, expect, it } from 'vitest';
import { ChatParamsSchema, KosFormSchema, SendMessageInputSchema } from './schemas';

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
  });

  it('rejects empty and oversized messages', () => {
    expect(SendMessageInputSchema.safeParse({ pesan: '  ' }).success).toBe(false);
    expect(SendMessageInputSchema.safeParse({ pesan: 'a'.repeat(1001) }).success).toBe(false);
  });

  it('rejects unknown modes in ChatParamsSchema', () => {
    expect(ChatParamsSchema.safeParse({ preferredMode: 'helikopter' }).success).toBe(false);
  });
});
