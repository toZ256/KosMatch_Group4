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

export const MAX_PRICE_OPTIONS = [2_000_000, 3_000_000, 4_000_000, 5_000_000];

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
