import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  ExternalLink,
  Filter,
  LogIn,
  MessageCircle,
  Scale,
} from 'lucide-react';
import type {
  AgentAction,
  ApplySearchFiltersPayload,
  BookmarkActionPayload,
  CompareKosPayload,
  WhatsAppDraftPayload,
} from '@kosmatch/shared';
import { useAddBookmark, useBookmarks, useToggleBookmark } from '../../api/hooks';
import { formatRupiah } from '../../lib/format';
import { useAuthStore } from '../../stores/authStore';

const INTENT_LABELS: Record<string, string> = {
  tanya_ketersediaan: 'Tanya Ketersediaan Kamar',
  jadwal_survei: 'Jadwalkan Survei Lokasi',
  negosiasi_harga: 'Negosiasi Harga Sewa',
  tanya_fasilitas: 'Tanya Detail Fasilitas',
};

export function WhatsAppDraftCard({
  action,
  onNavigate,
}: {
  action: AgentAction;
  onNavigate?: () => void;
}) {
  const payload = action.payload as unknown as WhatsAppDraftPayload;
  const token = useAuthStore((s) => s.token);
  const intentLabel = INTENT_LABELS[payload.intent ?? 'tanya_ketersediaan'] ?? 'Tanya Pemilik Kos';
  const rawInAppUrl =
    payload.inAppChatUrl ??
    (payload.ownerId
      ? `/chat/${payload.ownerId}${payload.draftMessage ? `?draft=${encodeURIComponent(payload.draftMessage)}` : ''}`
      : undefined);
  const inAppDestination = rawInAppUrl
    ? token
      ? rawInAppUrl
      : `/login?redirect=${encodeURIComponent(rawInAppUrl)}`
    : undefined;

  return (
    <div
      data-testid="whatsapp-action-card"
      className="overflow-hidden rounded-[22px] border border-accent/40 bg-surface p-3.5 shadow-card"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-bold text-ink">
          <MessageCircle size={12} className="text-accent" />
          Draf Pesan Pemilik · {intentLabel}
        </span>
        {payload.tipe && (
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold capitalize text-primary">
            Kos {payload.tipe}
          </span>
        )}
      </div>

      {payload.kosName && (
        <p className="mt-2 text-xs font-extrabold text-ink">
          {payload.kosName}{' '}
          {payload.hargaSewa ? (
            <span className="font-bold text-primary">({formatRupiah(payload.hargaSewa)}/bln)</span>
          ) : null}
        </p>
      )}

      {payload.draftMessage && (
        <blockquote className="mt-2 rounded-2xl border border-line/80 bg-bg/70 p-2.5 text-[11px] italic leading-relaxed text-ink">
          &ldquo;{payload.draftMessage}&rdquo;
        </blockquote>
      )}

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {inAppDestination && (
          <Link
            to={inAppDestination}
            onClick={onNavigate}
            data-testid="inapp-chat-link"
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-primary px-3.5 text-xs font-bold text-white shadow-tactile-primary transition hover:brightness-105 active:translate-y-[1px] active:shadow-none"
          >
            <MessageCircle size={14} />
            Chat Langsung di Aplikasi
            <ArrowRight size={12} />
          </Link>
        )}

        {payload.waUrl && (
          <a
            href={payload.waUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="whatsapp-open-link"
            className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-accent px-3.5 text-xs font-bold text-white shadow-tactile-accent transition hover:brightness-105 active:translate-y-[1px] active:shadow-none"
          >
            <MessageCircle size={14} />
            Chat via WhatsApp
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    </div>
  );
}

export function BookmarkActionCard({
  action,
  onNavigate,
}: {
  action: AgentAction;
  onNavigate: () => void;
}) {
  const payload = action.payload as unknown as BookmarkActionPayload;
  const token = useAuthStore((s) => s.token);
  const { data: savedKosList = [] } = useBookmarks();
  const addBookmark = useAddBookmark();
  const toggleBookmark = useToggleBookmark();

  const kosItems = payload.kosItems ?? [];
  const kosIds = payload.kosIds ?? [];

  if (payload.requiresAuth || !token) {
    return (
      <div
        data-testid="login-prompt-action-card"
        className="overflow-hidden rounded-[22px] border border-primary/35 bg-surface p-3.5 shadow-card"
      >
        <div className="flex items-center gap-2 text-xs font-bold text-ink">
          <LogIn size={15} className="text-primary" />
          <span>Silakan masuk terlebih dahulu untuk menyimpan kos ini</span>
        </div>
        <p className="mt-1 text-[11px] text-muted">
          Masuk sebagai penyewa agar daftar kos pilihan Anda tersimpan secara otomatis di akun KosMatch.
        </p>
        <Link
          to="/login?redirect=/&chatbot=1"
          onClick={onNavigate}
          className="mt-2.5 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-xs font-bold text-white shadow-tactile-primary transition hover:brightness-105"
        >
          Masuk ke Akun <ArrowRight size={13} />
        </Link>
      </div>
    );
  }

  const allSaved =
    kosIds.length > 0 && kosIds.every((id) => savedKosList.some((s) => s.id === id));

  return (
    <div
      data-testid="bookmark-action-card"
      className="overflow-hidden rounded-[22px] border border-accent/40 bg-surface p-3.5 shadow-card"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 text-[10px] font-bold text-ink">
          <BookmarkCheck size={12} className="text-accent" />
          Tersimpan Otomatis ({kosIds.length} Kos)
        </span>
        <Link
          to="/tersimpan"
          onClick={onNavigate}
          className="text-[11px] font-bold text-primary hover:underline"
        >
          Lihat Daftar Tersimpan →
        </Link>
      </div>

      {kosItems.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {kosItems.map((kos) => {
            const isSaved = savedKosList.some((s) => s.id === kos.id);
            return (
              <li
                key={kos.id}
                className="flex items-center justify-between gap-2 rounded-2xl bg-bg/75 px-3 py-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{kos.namaKos}</p>
                  <p className="text-[10px] text-muted">
                    {kos.area} · <span className="font-semibold text-primary">{formatRupiah(kos.hargaSewa)}/bln</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleBookmark.mutate({ kos, saved: isSaved })}
                  disabled={toggleBookmark.isPending}
                  className="shrink-0 rounded-full border border-line bg-surface px-2.5 py-1 text-[10px] font-bold text-ink transition hover:border-accent"
                >
                  {isSaved ? 'Batalkan' : 'Simpan'}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {!allSaved && kosIds.length > 0 && (
        <button
          type="button"
          onClick={() => addBookmark.mutate(kosIds)}
          disabled={addBookmark.isPending}
          className="mt-2.5 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-full bg-accent px-3 text-xs font-bold text-white transition hover:brightness-105 disabled:opacity-50"
        >
          <BookmarkPlus size={13} />
          Simpan Semua ke Bookmark
        </button>
      )}
    </div>
  );
}

export function ComparisonCard({
  action,
  onNavigate,
}: {
  action: AgentAction;
  onNavigate: () => void;
}) {
  const payload = action.payload as unknown as CompareKosPayload;
  const items = payload.items ?? [];
  if (items.length < 2) return null;

  return (
    <div
      data-testid="comparison-action-card"
      className="overflow-hidden rounded-[22px] border border-line bg-surface p-3.5 shadow-card"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
          <Scale size={12} />
          Komparasi {items.length} Kos Pilihan
        </span>
        {payload.destinationName && (
          <span className="truncate text-[10px] font-medium text-muted">
            Tujuan: {payload.destinationName}
          </span>
        )}
      </div>

      <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {items.map(({ kos, commute }) => {
          const ojek = commute.find((c) => c.mode === 'ojek');
          const transit = commute.find((c) => c.mode === 'transit');
          return (
            <div
              key={kos.id}
              className="flex flex-col justify-between rounded-2xl border border-line/80 bg-bg/65 p-2.5 text-[11px]"
            >
              <div>
                <div className="flex items-start justify-between gap-1">
                  <h5 className="font-extrabold text-ink">{kos.namaKos}</h5>
                  <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-bold capitalize text-ink">
                    {kos.tipe}
                  </span>
                </div>
                <p className="text-[10px] text-muted">{kos.area}</p>
                <p className="mt-1 text-xs font-extrabold text-primary">
                  {formatRupiah(kos.hargaSewa)}
                  <span className="text-[10px] font-normal text-muted">/bln</span>
                </p>

                <div className="mt-1.5 flex flex-wrap gap-1">
                  {kos.fasilitas.slice(0, 4).map((f) => (
                    <span
                      key={f}
                      className="rounded-full bg-surface px-1.5 py-0.5 text-[9px] font-medium text-ink shadow-sm"
                    >
                      {f}
                    </span>
                  ))}
                </div>

                <div className="mt-2 space-y-1 border-t border-line/70 pt-1.5 text-[10px]">
                  {ojek && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Estimasi Ojek:</span>
                      <span className="font-semibold text-ink">
                        {ojek.durationMin} mnt · {formatRupiah(ojek.costRp)}
                      </span>
                    </div>
                  )}
                  {transit && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted">Estimasi Transit:</span>
                      <span className="font-semibold text-ink">
                        {transit.durationMin} mnt · {formatRupiah(transit.costRp)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Link
                to={payload.destinationId ? `/kos/${kos.id}?destinationId=${payload.destinationId}` : `/kos/${kos.id}`}
                onClick={onNavigate}
                className="mt-2 inline-flex h-7 w-full items-center justify-center gap-1 rounded-full bg-surface text-[10px] font-bold text-ink shadow-sm transition hover:bg-accent hover:text-white"
              >
                Detail Kos <ArrowRight size={11} />
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SearchRedirectCard({
  action,
  onNavigate,
}: {
  action: AgentAction;
  onNavigate: () => void;
}) {
  const payload = action.payload as unknown as ApplySearchFiltersPayload;
  if (!payload.searchUrl) return null;

  return (
    <div
      data-testid="search-redirect-action-card"
      className="overflow-hidden rounded-[22px] border border-line/80 bg-surface p-3 shadow-sm"
    >
      <Link
        to={payload.searchUrl}
        onClick={onNavigate}
        className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-full bg-ink px-3.5 text-[11px] font-bold text-white transition hover:brightness-110"
      >
        <Filter size={12} />
        <span>{action.label}</span>
      </Link>
    </div>
  );
}

export function AgentActionList({
  actions,
  onNavigate,
}: {
  actions?: AgentAction[];
  onNavigate: () => void;
}) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="agent-actions-list">
      {actions.map((action, idx) => {
        const key = `${action.type}-${idx}`;
        switch (action.type) {
          case 'whatsapp_draft':
            return <WhatsAppDraftCard key={key} action={action} onNavigate={onNavigate} />;
          case 'bookmark_kos':
            return <BookmarkActionCard key={key} action={action} onNavigate={onNavigate} />;
          case 'compare_kos':
            return <ComparisonCard key={key} action={action} onNavigate={onNavigate} />;
          case 'search_redirect':
            return <SearchRedirectCard key={key} action={action} onNavigate={onNavigate} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
