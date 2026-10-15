import type { CommuteEstimate, Kos, KosWithCommute, TransportMode } from '@kosmatch/shared';

export const formatRupiah = (n: number): string =>
  `Rp ${Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export const formatRating = (rating: number): string => (rating > 0 ? rating.toFixed(1) : 'Baru');

export const MODE_LABELS: Record<TransportMode, string> = {
  ojek: 'Ojek',
  transit: 'Transit',
  jalan_kaki: 'Jalan kaki',
};

/** Picks the fastest estimate (used for the small badge on cards). */
export function fastestCommute(commute: CommuteEstimate[] | undefined): CommuteEstimate | undefined {
  return commute?.slice().sort((a, b) => a.durationMin - b.durationMin)[0];
}

export function formatTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/** CSS gradient used as a local photo placeholder, derived from Kos.fotoColor. */
export function photoGradient(color: string): string {
  return `linear-gradient(135deg, ${color} 0%, ${color}99 55%, #FFFFFF66 100%)`;
}

export type KosCardData = Kos | KosWithCommute;

export function initials(name: string): string {
  return name
    .replace(/\(.*?\)/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
