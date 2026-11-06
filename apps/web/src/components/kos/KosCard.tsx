import { memo } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Star } from 'lucide-react';
import type { CommuteEstimate, Kos } from '@kosmatch/shared';
import { BookmarkButton } from './BookmarkButton';
import { formatRating, formatRupiah, photoGradient } from '../../lib/format';
import { Skeleton } from '../ui/Card';

interface KosCardProps {
  kos: Kos;
  commute?: CommuteEstimate[];
  /** Carried to the detail page so the commute panel preselects the destination. */
  destinationId?: string;
}

export const KosCard = memo(function KosCard({ kos, commute, destinationId }: KosCardProps) {
  const ojek = commute?.find((c) => c.mode === 'ojek');
  const transit = commute?.find((c) => c.mode === 'transit');
  const to = destinationId ? `/kos/${kos.id}?destinationId=${destinationId}` : `/kos/${kos.id}`;
  return (
    <article className="kos-card-item group relative overflow-hidden rounded-[28px] border border-line/70 bg-surface p-2.5 shadow-card transition-[transform,box-shadow] duration-150 hover:-translate-y-1 hover:border-accent/40 hover:shadow-float">
      <Link to={to} className="block" aria-label={`Lihat ${kos.namaKos}`}>
        <div
          className="relative aspect-[4/3] w-full overflow-hidden rounded-[20px]"
          style={{ background: photoGradient(kos.fotoColor) }}
        >
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2.5 py-1 text-[11px] font-bold text-ink shadow-sm">
            <Star size={11} className="fill-primary text-primary" />
            {formatRating(kos.rating)}
          </span>
        </div>
        <div className="space-y-1.5 px-2 pb-2 pt-3.5">
          <h3 className="truncate text-sm font-extrabold tracking-tight text-ink group-hover:text-primary">{kos.namaKos}</h3>
          <p className="flex items-center gap-1 text-xs text-muted">
            <MapPin size={12} className="shrink-0 text-accent" />
            <span className="truncate">{kos.area}</span>
          </p>
          {commute && commute.length > 0 && (
            <div className="space-y-1 pt-0.5 text-[11px]">
              {ojek && (
                <p className="flex items-center justify-between rounded-full bg-bg px-2.5 py-0.5 font-medium text-ink">
                  <span className="text-muted">Estimasi Ojek:</span>
                  <span>
                    {ojek.durationMin} mnt · {formatRupiah(ojek.costRp)}
                  </span>
                </p>
              )}
              {transit && (
                <p className="flex items-center justify-between rounded-full bg-bg px-2.5 py-0.5 font-medium text-ink">
                  <span className="text-muted">Estimasi Kereta:</span>
                  <span>
                    {transit.durationMin} mnt · {formatRupiah(transit.costRp)}
                  </span>
                </p>
              )}
            </div>
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
