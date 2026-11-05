import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronUp, MapPin, Navigation } from 'lucide-react';
import type { ChatbotResultItem } from '@kosmatch/shared';
import { BookmarkButton } from '../kos/BookmarkButton';
import { MODE_LABELS, formatRupiah, photoGradient } from '../../lib/format';

export function MessageBubble({ role, children }: { role: 'bot' | 'user'; children: React.ReactNode }) {
  return (
    <div className={role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
      <div
        className={
          role === 'user'
            ? 'max-w-[85%] whitespace-pre-wrap break-words rounded-[22px] rounded-br-md bg-ink px-4 py-3 text-xs leading-relaxed text-white shadow-sm'
            : 'max-w-[90%] whitespace-pre-wrap break-words rounded-[22px] rounded-bl-md border border-line/70 bg-surface px-4 py-3 text-xs leading-relaxed text-ink shadow-sm'
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
      <div className="flex items-center gap-1.5 rounded-full border border-line/70 bg-surface px-4 py-3 shadow-sm">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-dot-bounce rounded-full bg-accent" style={{ animationDelay: `${i * 0.15}s` }} />
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
  const [showCommute, setShowCommute] = useState(false);
  const to = destinationId ? `/kos/${kos.id}?destinationId=${destinationId}` : `/kos/${kos.id}`;
  const previewFacilities = kos.fasilitas.slice(0, 4);

  return (
    <div data-testid="result-card" className="overflow-hidden rounded-[26px] border border-line/70 bg-surface p-3.5 shadow-card transition hover:shadow-float">
      <div className="flex items-center gap-3">
        <div
          className="h-14 w-14 shrink-0 rounded-2xl shadow-inner"
          style={{ background: photoGradient(kos.fotoColor) }}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-extrabold text-ink">{kos.namaKos}</h4>
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted">
            <MapPin size={11} className="shrink-0 text-accent" />
            <span className="truncate">{kos.area}</span>
          </p>
          <p className="mt-1">
            <span className="text-sm font-extrabold text-primary">{formatRupiah(kos.hargaSewa)}</span>{' '}
            <span className="text-[11px] text-muted">/bulan</span>
          </p>
        </div>
        <BookmarkButton kos={kos} className="!bg-bg/80 hover:!bg-bg" />
      </div>

      {previewFacilities.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold capitalize text-primary">
            Kos {kos.tipe}
          </span>
          {previewFacilities.map((f) => (
            <span key={f} className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-medium text-ink">
              {f}
            </span>
          ))}
        </div>
      )}

      {commute.length > 0 && (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setShowCommute((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-2xl border border-line/80 bg-bg/70 px-3 py-2 text-[11px] font-bold text-ink transition hover:border-accent/50 hover:bg-bg"
          >
            <span className="inline-flex items-center gap-1.5">
              <Navigation size={12} className="text-accent" />
              {showCommute ? 'Sembunyikan Estimasi Transportasi' : 'Lihat Estimasi Transportasi'}
            </span>
            {showCommute ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
          </button>

          {showCommute && (
            <ul className="mt-1.5 space-y-1 rounded-2xl bg-bg/80 px-3.5 py-2.5 text-[11px] text-ink">
              {commute.map((c) => (
                <li key={c.mode} className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    <span className="text-muted">Estimasi</span> {MODE_LABELS[c.mode]}
                  </span>
                  <span className="rounded-full bg-surface px-2.5 py-0.5 font-semibold shadow-sm">
                    {c.durationMin} mnt · {c.costRp === 0 ? 'Gratis' : formatRupiah(c.costRp)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Link
        to={to}
        onClick={onNavigate}
        className="mt-2.5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-primary text-xs font-bold text-white shadow-tactile-primary transition hover:brightness-105 active:translate-y-[1px] active:shadow-none"
      >
        Lihat Detail <ArrowRight size={13} />
      </Link>
    </div>
  );
}
