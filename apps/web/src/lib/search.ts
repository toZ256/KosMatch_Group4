export interface BudgetRange {
  value: string;
  label: string;
  min?: number;
  max?: number;
}

export const BUDGET_RANGES: BudgetRange[] = [
  { value: 'lt2', label: '< 2 jt', max: 2_000_000 },
  { value: '2-3', label: '2 - 3 jt', min: 2_000_000, max: 3_000_000 },
  { value: '3-4', label: '3 - 4 jt', min: 3_000_000, max: 4_000_000 },
  { value: 'gt4', label: '> 4 jt', min: 4_000_000 },
];

export const COMMUTE_OPTIONS = [15, 30, 45, 60];

export const MAX_PRICE_OPTIONS = [
  1_000_000,
  1_500_000,
  2_000_000,
  2_500_000,
  3_000_000,
  4_000_000,
  5_000_000,
  7_500_000,
  10_000_000,
];

export interface FacilityFilterOption {
  id: string;
  label: string;
  keywords: string[];
}

export const FACILITY_FILTER_OPTIONS: FacilityFilterOption[] = [
  { id: 'ac', label: 'AC', keywords: ['ac'] },
  { id: 'km_dalam', label: 'Kamar Mandi Dalam', keywords: ['mandi dalam', 'km dalam', 'k. mandi dalam'] },
  { id: 'km_luar', label: 'Kamar Mandi Luar', keywords: ['mandi luar', 'km luar', 'k. mandi luar'] },
  { id: 'wifi', label: 'WiFi', keywords: ['wifi', 'wi-fi'] },
  { id: 'kasur', label: 'Kasur', keywords: ['kasur'] },
  { id: 'meja', label: 'Meja', keywords: ['meja'] },
  { id: 'lemari', label: 'Lemari Baju', keywords: ['lemari'] },
  { id: 'dapur', label: 'Dapur', keywords: ['dapur'] },
  { id: 'parkir_motor', label: 'Parkir Motor', keywords: ['parkir motor', 'parkir'] },
  { id: 'parkir_mobil', label: 'Parkir Mobil', keywords: ['parkir mobil'] },
  { id: 'air_panas', label: 'Air Panas', keywords: ['air panas', 'water heater', 'shower panas'] },
  { id: 'laundry', label: 'Laundry', keywords: ['laundry', 'mesin cuci', 'r. cuci'] },
];

export function kosHasFilteredFacility(
  kos: { fasilitas?: string[]; deskripsi?: string },
  facilityId: string,
): boolean {
  const opt = FACILITY_FILTER_OPTIONS.find((f) => f.id === facilityId);
  if (!opt) return true;
  const list = (kos.fasilitas ?? []).map((f) => f.toLowerCase().trim());
  const desc = (kos.deskripsi ?? '').toLowerCase();

  if (facilityId === 'ac') {
    return (
      list.some((f) => f === 'ac' || f.startsWith('ac ') || f.endsWith(' ac')) ||
      /\bac\b/i.test(desc)
    );
  }

  return (
    list.some((f) => opt.keywords.some((kw) => f.includes(kw))) ||
    opt.keywords.some((kw) => desc.includes(kw))
  );
}

export function getPaginationPages(current: number, total: number): Array<number | '...'> {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total];
  }
  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, '...', current - 1, current, current + 1, '...', total];
}

export interface SearchValues {
  destinationId: string;
  maxCommuteMin: string;
  budget: string;
}

export function toSearchString(values: Partial<SearchValues>, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...values, ...extra })) if (v) params.set(k, v);
  const s = params.toString();
  return s ? `?${s}` : '';
}
