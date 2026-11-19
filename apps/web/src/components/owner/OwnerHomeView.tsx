import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Edit2,
  Eye,
  MapPin,
  MessageCircle,
  Plus,
  Star,
} from 'lucide-react';
import type { TipeKos } from '@kosmatch/shared';
import { useConversations, useOwnerKos } from '../../api/hooks';
import { Button } from '../ui/Button';
import { EmptyState, Avatar } from '../ui/EmptyState';
import { formatRating, formatRupiah, formatTime, photoGradient } from '../../lib/format';
import { computePortfolioMetrics, evaluateListingReadiness } from '../../lib/owner';
import { cn } from '../../lib/cn';

type TypeFilter = 'semua' | TipeKos;

const TYPE_TABS: Array<{ id: TypeFilter; label: string }> = [
  { id: 'semua', label: 'Semua' },
  { id: 'putra', label: 'Putra' },
  { id: 'putri', label: 'Putri' },
  { id: 'campur', label: 'Campur' },
];

export function OwnerHomeView({ nama }: { nama: string }) {
  const { data: kosList = [], isLoading: loadingKos } = useOwnerKos();
  const { data: conversations = [], isLoading: loadingChats } = useConversations();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('semua');

  const metrics = useMemo(() => computePortfolioMetrics(kosList), [kosList]);

  const filteredKos = useMemo(() => {
    if (typeFilter === 'semua') return kosList;
    return kosList.filter((k) => k.tipe === typeFilter);
  }, [kosList, typeFilter]);

  return (
    <div className="page-container pb-16 pt-6 sm:pt-8">
      {/* Top Operational Command Header */}
      <header className="flex flex-col gap-4 border-b border-line pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-accent">
            Panel Pemilik Kos
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Halo, {nama}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {loadingKos
              ? 'Memuat ringkasan portofolio properti Anda...'
              : `${metrics.total} properti terdaftar · ${metrics.readyCount} siap tayang · ${conversations.length} percakapan calon penyewa`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link to="/chat">
            <Button variant="outline" size="md" pill={false}>
              <MessageCircle size={15} className="text-accent" />
              Kotak Masuk{conversations.length > 0 ? ` (${conversations.length})` : ''}
            </Button>
          </Link>
          <Link to="/owner/kos/baru">
            <Button id="owner-home-add-kos" size="md" pill={false}>
              <Plus size={16} /> Tambah Kos Baru
            </Button>
          </Link>
        </div>
      </header>

      {/* Unified 4-Column Operational Ledger Strip */}
      <section
        aria-label="Ringkasan portofolio"
        className="mt-6 grid grid-cols-1 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x"
      >
        <div className="p-5">
          <p className="text-xs font-semibold text-muted">Total Properti</p>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-ink">
            {loadingKos ? '—' : metrics.total}
            <span className="ml-1 text-sm font-medium text-muted">unit kos</span>
          </p>
          <p className="mt-1.5 text-[11px] text-muted">
            {metrics.byType.putra} Putra · {metrics.byType.putri} Putri · {metrics.byType.campur} Campur
          </p>
        </div>

        <div className="p-5 sm:border-l sm:border-line lg:border-l-0">
          <p className="text-xs font-semibold text-muted">Rata-Rata Sewa / Bulan</p>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-primary">
            {loadingKos ? '—' : metrics.avgPrice ? formatRupiah(metrics.avgPrice) : 'Belum ada'}
          </p>
          <p className="mt-1.5 truncate text-[11px] text-muted">
            {metrics.minPrice && metrics.maxPrice
              ? metrics.minPrice === metrics.maxPrice
                ? 'Tarif seragam di seluruh properti'
                : `Rentang ${formatRupiah(metrics.minPrice)} – ${formatRupiah(metrics.maxPrice)}`
              : 'Tambahkan kos untuk melihat rata-rata tarif'}
          </p>
        </div>

        <div className="p-5 sm:border-t sm:border-line lg:border-t-0">
          <p className="text-xs font-semibold text-muted">Kualitas &amp; Rating</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="inline-flex items-center gap-1 text-2xl font-extrabold tabular-nums text-ink">
              <Star size={18} className="fill-primary text-primary" />
              {loadingKos ? '—' : metrics.avgRating ? metrics.avgRating.toFixed(1) : 'Baru'}
            </span>
            <span className="text-xs font-medium text-muted">
              ({metrics.readyCount}/{metrics.total} siap tayang)
            </span>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            {metrics.needsAttention.length > 0
              ? `${metrics.needsAttention.length} properti perlu dilengkapi`
              : metrics.total > 0
                ? 'Seluruh listing sudah lengkap'
                : 'Belum ada data listing'}
          </p>
        </div>

        <div className="p-5 sm:border-l sm:border-t sm:border-line lg:border-l-0 lg:border-t-0">
          <p className="text-xs font-semibold text-muted">Pesan Calon Penyewa</p>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-ink">
            {loadingChats ? '—' : conversations.length}
            <span className="ml-1 text-sm font-medium text-muted">percakapan</span>
          </p>
          <Link
            to="/chat"
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-accent transition hover:underline"
          >
            Buka kotak masuk <ArrowRight size={12} />
          </Link>
        </div>
      </section>

      {/* Main Operational Split Workspace */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        {/* Left: Portfolio Management Quick List */}
        <section aria-labelledby="owner-portfolio-heading" className="min-w-0">
          <div className="rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 id="owner-portfolio-heading" className="text-base font-bold text-ink">
                  Portofolio Properti
                </h2>
                <p className="text-xs text-muted">
                  Akses cepat ubah, duplikat, atau tinjau halaman publik kos Anda.
                </p>
              </div>
              <Link
                to="/owner/kos"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                Semua ({kosList.length}) <ArrowRight size={13} />
              </Link>
            </div>

            {/* Instant Segmented Type Filter */}
            {kosList.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-bg/50 px-5 py-2.5">
                {TYPE_TABS.map((tab) => {
                  const count = tab.id === 'semua' ? kosList.length : metrics.byType[tab.id];
                  const active = typeFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTypeFilter(tab.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                        active
                          ? 'bg-ink text-white'
                          : 'bg-surface text-muted border border-line hover:text-ink',
                      )}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.2 text-[10px] tabular-nums',
                          active ? 'bg-white/20 text-white' : 'bg-bg text-muted',
                        )}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="p-4">
              {loadingKos ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }, (_, i) => (
                    <div key={i} className="h-24 animate-pulse rounded-xl bg-ink/5" />
                  ))}
                </div>
              ) : kosList.length === 0 ? (
                <EmptyState
                  title="Belum ada properti terdaftar"
                  description="Daftarkan kos pertama Anda agar langsung muncul di hasil pencarian dan rekomendasi calon penyewa."
                  action={
                    <Link to="/owner/kos/baru">
                      <Button pill={false}>
                        <Plus size={16} /> Tambah Kos Pertama
                      </Button>
                    </Link>
                  }
                />
              ) : filteredKos.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm font-semibold text-ink">Tidak ada kos tipe {typeFilter}</p>
                  <p className="mt-1 text-xs text-muted">
                    Tambahkan kos tipe {typeFilter} baru atau lihat seluruh tipe properti.
                  </p>
                  <div className="mt-4 flex justify-center gap-2">
                    <Button variant="outline" size="sm" pill={false} onClick={() => setTypeFilter('semua')}>
                      Tampilkan Semua
                    </Button>
                    <Link to="/owner/kos/baru">
                      <Button size="sm" pill={false}>
                        <Plus size={14} /> Tambah Kos
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {filteredKos.slice(0, 6).map((k) => {
                    const readiness = evaluateListingReadiness(k);
                    return (
                      <li
                        key={k.id}
                        className="flex flex-col gap-3 py-3.5 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3.5">
                          <div
                            className="h-14 w-14 shrink-0 rounded-xl border border-line/60"
                            style={{ background: photoGradient(k.fotoColor) }}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                to={`/owner/kos/${k.id}/edit`}
                                className="truncate text-sm font-bold text-ink transition hover:text-primary"
                              >
                                {k.namaKos}
                              </Link>
                              <span className="rounded-md border border-line bg-bg px-1.5 py-0.5 text-[10px] font-semibold capitalize text-ink">
                                {k.tipe}
                              </span>
                              <span
                                className={cn(
                                  'rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                                  readiness.score >= 80
                                    ? 'bg-accent/15 text-ink'
                                    : 'bg-primary/10 text-primary',
                                )}
                              >
                                {readiness.label} · {readiness.score}%
                              </span>
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
                              <span className="inline-flex items-center gap-1 truncate">
                                <MapPin size={12} className="shrink-0 text-accent" />
                                {k.area}
                              </span>
                              <span className="font-bold tabular-nums text-primary">
                                {formatRupiah(k.hargaSewa)}/bln
                              </span>
                              <span className="inline-flex items-center gap-0.5 tabular-nums">
                                <Star size={11} className="fill-primary text-primary" />
                                {formatRating(k.rating)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-1.5">
                          <Link
                            to={`/owner/kos/${k.id}/edit`}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-ink transition hover:border-ink/30 hover:bg-bg"
                          >
                            <Edit2 size={12} /> Ubah
                          </Link>
                          <Link
                            to={`/owner/kos/baru?from=${encodeURIComponent(k.id)}`}
                            title="Duplikat data kos ini untuk membuat properti baru dengan cepat"
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-muted transition hover:border-ink/30 hover:bg-bg hover:text-ink"
                          >
                            <Copy size={12} /> Duplikat
                          </Link>
                          <Link
                            to={`/kos/${k.id}`}
                            title="Lihat tampilan publik kos"
                            aria-label={`Lihat halaman publik ${k.namaKos}`}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:border-ink/30 hover:bg-bg hover:text-ink"
                          >
                            <Eye size={13} />
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* Right: Priority Inbox + Listing Quality Audit */}
        <div className="space-y-6">
          {/* Priority Tenant Messages */}
          <section aria-labelledby="owner-inbox-heading" className="rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 id="owner-inbox-heading" className="text-base font-bold text-ink">
                  Pesan Calon Penyewa
                </h2>
                <p className="text-xs text-muted">Respons cepat meningkatkan peluang kamar terisi.</p>
              </div>
              <Link to="/chat" className="text-xs font-semibold text-accent hover:underline">
                Kotak Masuk
              </Link>
            </div>

            <div className="p-4">
              {loadingChats ? (
                <div className="space-y-2.5">
                  <div className="h-14 animate-pulse rounded-xl bg-ink/5" />
                  <div className="h-14 animate-pulse rounded-xl bg-ink/5" />
                </div>
              ) : conversations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line bg-bg/50 px-4 py-8 text-center">
                  <MessageCircle size={22} className="mx-auto text-muted" />
                  <p className="mt-2 text-sm font-semibold text-ink">Belum ada pesan masuk</p>
                  <p className="mt-1 text-xs text-muted">
                    Pertanyaan ketersediaan kamar dan jadwal survei dari calon penyewa akan tampil di sini.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {conversations.slice(0, 4).map((c) => (
                    <li key={c.otherUser.id}>
                      <Link
                        to={`/chat/${c.otherUser.id}`}
                        className="group flex items-center gap-3 rounded-xl border border-line/80 bg-bg/40 px-3.5 py-3 transition hover:border-accent/50 hover:bg-bg"
                      >
                        <Avatar name={c.otherUser.nama} size={36} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <p className="truncate text-sm font-bold text-ink group-hover:text-primary">
                              {c.otherUser.nama}
                            </p>
                            <span className="shrink-0 text-[10px] text-muted">
                              {formatTime(c.last.sentAt)}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted">{c.last.pesan}</p>
                        </div>
                        <span className="shrink-0 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-white">
                          Balas
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Real Listing Quality Audit */}
          <section aria-labelledby="owner-audit-heading" className="rounded-2xl border border-line bg-surface shadow-card">
            <div className="border-b border-line px-5 py-4">
              <h2 id="owner-audit-heading" className="text-base font-bold text-ink">
                Audit Kelengkapan Properti
              </h2>
              <p className="text-xs text-muted">
                Pastikan pin lokasi &amp; fasilitas lengkap agar mudah ditemukan penyewa.
              </p>
            </div>

            <div className="p-4">
              {metrics.total === 0 ? (
                <p className="text-xs text-muted">
                  Audit kelengkapan akan aktif otomatis setelah Anda mendaftarkan minimal satu properti kos.
                </p>
              ) : metrics.needsAttention.length === 0 ? (
                <div className="flex items-start gap-3 rounded-xl border border-accent/30 bg-accent/10 p-3.5">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-accent" />
                  <div>
                    <p className="text-xs font-bold text-ink">Semua properti siap tayang</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                      Seluruh {metrics.total} kos Anda sudah memenuhi standar kelengkapan lokasi, fasilitas, dan deskripsi.
                    </p>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {metrics.needsAttention.slice(0, 3).map(({ kos, readiness }) => {
                    const firstMissing = readiness.checks.find((c) => !c.done);
                    return (
                      <li
                        key={kos.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-line bg-bg/50 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <AlertCircle size={14} className="shrink-0 text-primary" />
                            <p className="truncate text-xs font-bold text-ink">{kos.namaKos}</p>
                          </div>
                          {firstMissing && (
                            <p className="mt-1 text-[11px] leading-snug text-muted">
                              {firstMissing.label}: {firstMissing.hint}
                            </p>
                          )}
                        </div>
                        <Link
                          to={`/owner/kos/${kos.id}/edit`}
                          className="shrink-0 rounded-lg border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary transition hover:bg-primary hover:text-white"
                        >
                          Lengkapi
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
