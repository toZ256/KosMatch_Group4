import { memo } from 'react';
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

export const KosCard = memo(function KosCard({ kos, commute, destinationId }: KosCardProps) {
  const best = fastestCommute(commute);
  const to = destinationId ? `/kos/${kos.id}?destinationId=${destinationId}` : `/kos/${kos.id}`;
  return (
    <article className="kos-card-item group relative overflow-hidden rounded-[28px] border border-line/70 bg-surface p-2.5 shadow-card transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:border-accent/40 hover:shadow-float">
      <Link to={to} className="block" aria-label={`Lihat ${kos.namaKos}`}>
        <div
          className="relative aspect-[4/3] w-full overflow-hidden rounded-[20px]"
          style={{ background: photoGradient(kos.fotoColor) }}
        >
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2.5 py-1 text-[11px] font-bold text-ink shadow-sm">
            {best ? <Timer size={11} className="text-accent" /> : <Star size={11} className="fill-primary text-primary" />}
            {best ? `${best.durationMin} mnt` : formatRating(kos.rating)}
          </span>
        </div>
        <div className="space-y-1.5 px-2 pb-2 pt-3.5">
          <h3 className="truncate text-sm font-extrabold tracking-tight text-ink group-hover:text-primary">{kos.namaKos}</h3>
          <p className="flex items-center gap-1 text-xs text-muted">
            <MapPin size={12} className="shrink-0 text-accent" />
            <span className="truncate">{kos.area}</span>
          </p>
          {best && (
            <p className="inline-block rounded-full bg-bg px-2.5 py-0.5 text-[11px] font-medium text-ink">
              Estimasi {MODE_LABELS[best.mode]}: {best.durationMin} mnt · {best.costRp === 0 ? 'Gratis' : formatRupiah(best.costRp)}
            </p>
          )}
          <p className="pt-1">
            <span className="text-base font-extrabold text-primary">{formatRupiah(kos.hargaSewa)}</span>{' '}
            <span className="text-[11px] font-medium text-muted">/bulan</span>
          </p>
        </div>
      </Link>
      <BookmarkButton kos={kos} className="absolute right-5 top-5" />
    </article>
  );
});

export function KosCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-line/60 bg-surface p-2.5 shadow-card">
      <Skeleton className="aspect-[4/3] w-full rounded-[20px]" />
      <div className="space-y-2 px-2 pb-2 pt-3.5">
        <Skeleton className="h-4 w-3/4 rounded-full" />
        <Skeleton className="h-3 w-1/2 rounded-full" />
        <Skeleton className="h-4 w-2/5 rounded-full" />
      </div>
    </div>
  );
}

export function KosGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}
