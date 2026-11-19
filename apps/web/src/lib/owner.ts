import { isValidGoogleMapsUrl, type Kos } from '@kosmatch/shared';

export const DEFAULT_JAKARTA_LAT = -6.2088;
export const DEFAULT_JAKARTA_LNG = 106.8456;

export interface ReadinessCheckItem {
  id: 'nama' | 'lokasi' | 'harga' | 'fasilitas' | 'deskripsi';
  label: string;
  done: boolean;
  hint: string;
}

export interface ListingReadiness {
  score: number;
  checks: ReadinessCheckItem[];
  isDefaultCoords: boolean;
  label: 'Siap Tayang' | 'Perlu Dilengkapi' | 'Draf Awal';
}

export function isDefaultCoordinate(lat: number, lng: number): boolean {
  return (
    Math.abs(lat - DEFAULT_JAKARTA_LAT) < 0.0002 &&
    Math.abs(lng - DEFAULT_JAKARTA_LNG) < 0.0002
  );
}

/**
 * Computes an objective listing completeness score (0-100) for property owners
 * based on real listing fields (name, locked coordinates, valid price, amenities, description).
 */
export function evaluateListingReadiness(input: {
  namaKos: string;
  area: string;
  hargaSewa: number;
  latitude: number;
  longitude: number;
  googleMapsUrl?: string;
  fasilitas: string[];
  deskripsi: string;
}): ListingReadiness {
  const defaultCoords = isDefaultCoordinate(input.latitude, input.longitude);
  const hasValidMapsLink = Boolean(input.googleMapsUrl && isValidGoogleMapsUrl(input.googleMapsUrl));
  const hasNama = input.namaKos.trim().length >= 3;
  const hasLokasi = input.area.trim().length >= 2 && (!defaultCoords || hasValidMapsLink);
  const hasHarga = Number.isFinite(input.hargaSewa) && input.hargaSewa >= 100000;
  const hasFasilitas = input.fasilitas.length >= 3;
  const hasDeskripsi = input.deskripsi.trim().length >= 40;

  const checks: ReadinessCheckItem[] = [
    {
      id: 'nama',
      label: 'Nama properti jelas',
      done: hasNama,
      hint: 'Minimal 3 karakter, sertakan ciri khas kos.',
    },
    {
      id: 'lokasi',
      label: hasValidMapsLink ? 'Kawasan & link Google Maps terpasang' : 'Kawasan & pin lokasi terkunci',
      done: hasLokasi,
      hint: defaultCoords
        ? 'Pilih kawasan dari saran, tempel link Google Maps, atau gunakan GPS.'
        : 'Isi area kos dengan benar.',
    },
    {
      id: 'harga',
      label: 'Harga sewa bulanan valid',
      done: hasHarga,
      hint: 'Masukkan tarif per bulan minimal Rp 100.000.',
    },
    {
      id: 'fasilitas',
      label: 'Minimal 3 fasilitas utama',
      done: hasFasilitas,
      hint: 'Listing dengan ≥ 3 fasilitas lebih sering muncul di filter penyewa.',
    },
    {
      id: 'deskripsi',
      label: 'Deskripsi informatif (≥ 40 karakter)',
      done: hasDeskripsi,
      hint: 'Jelaskan akses transportasi, aturan tamu, atau info listrik.',
    },
  ];

  const completed = checks.filter((c) => c.done).length;
  const score = Math.round((completed / checks.length) * 100);
  const label: ListingReadiness['label'] =
    score >= 80 ? 'Siap Tayang' : score >= 40 ? 'Perlu Dilengkapi' : 'Draf Awal';

  return { score, checks, isDefaultCoords: defaultCoords, label };
}

export interface PortfolioMetrics {
  total: number;
  byType: { putra: number; putri: number; campur: number };
  minPrice: number | null;
  maxPrice: number | null;
  avgPrice: number | null;
  avgRating: number | null;
  readyCount: number;
  needsAttention: Array<{ kos: Kos; readiness: ListingReadiness }>;
}

export function computePortfolioMetrics(kosList: Kos[]): PortfolioMetrics {
  const byType = { putra: 0, putri: 0, campur: 0 };
  let priceSum = 0;
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let ratingSum = 0;
  let ratedCount = 0;
  let readyCount = 0;
  const needsAttention: Array<{ kos: Kos; readiness: ListingReadiness }> = [];

  for (const kos of kosList) {
    byType[kos.tipe]++;
    priceSum += kos.hargaSewa;
    if (kos.hargaSewa < minPrice) minPrice = kos.hargaSewa;
    if (kos.hargaSewa > maxPrice) maxPrice = kos.hargaSewa;
    if (kos.rating > 0) {
      ratingSum += kos.rating;
      ratedCount++;
    }
    const readiness = evaluateListingReadiness(kos);
    if (readiness.score >= 80) {
      readyCount++;
    } else {
      needsAttention.push({ kos, readiness });
    }
  }

  return {
    total: kosList.length,
    byType,
    minPrice: kosList.length > 0 ? minPrice : null,
    maxPrice: kosList.length > 0 ? maxPrice : null,
    avgPrice: kosList.length > 0 ? Math.round(priceSum / kosList.length) : null,
    avgRating: ratedCount > 0 ? Number((ratingSum / ratedCount).toFixed(1)) : null,
    readyCount,
    needsAttention,
  };
}

export const OWNER_PRICE_PRESETS = [
  { label: 'Rp 1 jt', value: 1000000 },
  { label: 'Rp 1,5 jt', value: 1500000 },
  { label: 'Rp 2 jt', value: 2000000 },
  { label: 'Rp 2,5 jt', value: 2500000 },
  { label: 'Rp 3 jt', value: 3000000 },
] as const;

export const OWNER_DESCRIPTION_TEMPLATES = [
  {
    label: 'Akses Strategis',
    text: 'Lokasi strategis dekat transportasi umum, minimarket, dan pusat kuliner. Lingkungan aman, akses 24 jam, cocok untuk mahasiswa maupun pekerja.',
  },
  {
    label: 'Tenang & Nyaman',
    text: 'Suasana kos tenang, bersih, dan terawat. Dilengkapi sirkulasi udara baik, keamanan CCTV, serta area bersama yang rutin dibersihkan.',
  },
  {
    label: 'Info Sewa & Aturan',
    text: 'Harga sewa sudah termasuk WiFi dan iuran kebersihan. Listrik menggunakan token masing-masing kamar. Tamu berkunjung maksimal pukul 22.00 WIB.',
  },
] as const;

export const OWNER_CHAT_QUICK_REPLIES = [
  {
    label: 'Kamar tersedia',
    text: 'Halo, kamar masih tersedia untuk periode sewa bulan depan. Rencana mulai masuk tanggal berapa ya?',
  },
  {
    label: 'Ajak survei',
    text: 'Boleh sekali jika ingin survei lokasi terlebih dahulu. Kira-kira bisa datang hari apa dan jam berapa?',
  },
  {
    label: 'Detail harga & fasilitas',
    text: 'Harga sewa sudah termasuk WiFi dan kebersihan area umum. Untuk fasilitas lengkap sudah sesuai yang tertera di halaman kos.',
  },
] as const;
