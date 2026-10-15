import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import type { ChatbotResultItem } from '@kosmatch/shared';
import { BookmarkButton } from '../kos/BookmarkButton';
import { MODE_LABELS, formatRupiah } from '../../lib/format';

export function MessageBubble({ role, children }: { role: 'bot' | 'user'; children: React.ReactNode }) {
  return (
    <div className={role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={
          role === 'user'
            ? 'max-w-[85%] whitespace-pre-wrap break-words rounded-2xl bg-ink px-4 py-2.5 text-xs leading-relaxed text-white'
            : 'max-w-[90%] whitespace-pre-wrap break-words rounded-2xl border border-line bg-bg px-4 py-2.5 text-xs leading-relaxed text-ink'
        }
      >
        {children}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex justify-start" aria-label="Bot sedang mengetik" role="status">
      <div className="flex items-center gap-1 rounded-2xl border border-line bg-bg px-4 py-3">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  );
}

export function ResultCard({
  item,
  destinationId,
  onNavigate,
}: {
  item: ChatbotResultItem;
  destinationId?: string;
  onNavigate: () => void;
}) {
  const { kos, commute } = item;
  const to = destinationId ? `/kos/${kos.id}?destinationId=${destinationId}` : `/kos/${kos.id}`;
  return (
    <div data-testid="result-card" className="rounded-2xl border border-line bg-surface p-3 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-sm font-bold text-ink">{kos.namaKos}</h4>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
            <MapPin size={11} /> {kos.area}
          </p>
        </div>
        <BookmarkButton kos={kos} className="!bg-bg" />
      </div>
      <p className="mt-1.5">
        <span className="text-sm font-bold text-primary">{formatRupiah(kos.hargaSewa)}</span>{' '}
        <span className="text-[11px] text-muted">/bulan</span>
      </p>
      {commute.length > 0 && (
        <ul className="mt-2 space-y-0.5 rounded-xl bg-bg px-3 py-2 text-[11px] text-ink">
          {commute.map((c) => (
            <li key={c.mode} className="flex justify-between gap-2">
              <span>
                <span className="text-muted">Estimasi</span> {MODE_LABELS[c.mode]}
              </span>
              <span className="font-medium">
                {c.durationMin} mnt · {c.costRp === 0 ? 'Gratis' : formatRupiah(c.costRp)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        to={to}
        onClick={onNavigate}
        className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-full bg-primary text-xs font-semibold text-white hover:brightness-95"
      >
        Lihat Detail
      </Link>
    </div>
  );
}
