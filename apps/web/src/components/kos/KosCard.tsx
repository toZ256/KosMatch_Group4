import { Link } from 'react-router-dom';
import { MapPin, Star, Timer } from 'lucide-react';
import type { CommuteEstimate, Kos } from '@kosmatch/shared';
import { BookmarkButton } from './BookmarkButton';
import { MODE_LABELS, fastestCommute, formatRating, formatRupiah, photoGradient } from '../../lib/format';
import { Skeleton } from '../ui/Card';

interface KosCardProps {
  kos: Kos;
  commute?: CommuteEstimate[];
  /** Carried to the detail page so the commute panel preselects the destination. */
  destinationId?: string;
}

export function KosCard({ kos, commute, destinationId }: KosCardProps) {
  const best = fastestCommute(commute);
  const to = destinationId ? `/kos/${kos.id}?destinationId=${destinationId}` : `/kos/${kos.id}`;
  return (
    <article className="group relative overflow-hidden rounded-card bg-surface shadow-card transition hover:-translate-y-0.5 hover:shadow-lg">
      <Link to={to} className="block" aria-label={`Lihat ${kos.namaKos}`}>
        <div className="relative aspect-[4/3] w-full" style={{ background: photoGradient(kos.fotoColor) }}>
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-surface/90 px-2 py-1 text-[11px] font-semibold text-ink">
            {best ? <Timer size={11} /> : <Star size={11} className="fill-primary text-primary" />}
            {best ? `${best.durationMin} mnt` : formatRating(kos.rating)}
          </span>
        </div>
        <div className="space-y-1 p-4">
          <h3 className="truncate text-sm font-bold text-ink">{kos.namaKos}</h3>
          <p className="flex items-center gap-1 text-xs text-muted">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{kos.area}</span>
          </p>
          {best && (
            <p className="text-[11px] text-muted">
              Estimasi {MODE_LABELS[best.mode]}: {best.durationMin} mnt · {best.costRp === 0 ? 'Gratis' : formatRupiah(best.costRp)}
            </p>
          )}
          <p className="pt-1">
            <span className="text-sm font-bold text-primary">{formatRupiah(kos.hargaSewa)}</span>{' '}
            <span className="text-[11px] text-muted">/bulan</span>
          </p>
        </div>
      </Link>
      <BookmarkButton kos={kos} className="absolute right-3 top-3" />
    </article>
  );
}

export function KosCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card bg-surface shadow-card">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-4 w-2/5" />
      </div>
    </div>
  );
}

export function KosGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}
