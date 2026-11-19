import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  AlertCircle,
  ArrowLeft,
  Bath,
  Car,
  Check,
  CheckCircle2,
  Copy,
  Crosshair,
  Edit2,
  ExternalLink,
  Eye,
  LayoutGrid,
  LayoutList,
  Link2,
  MapPin,
  Plus,
  Search,
  Shirt,
  Star,
  Trash2,
  Users,
  Utensils,
  Wifi,
  Wind,
  X,
} from 'lucide-react';
import {
  FASILITAS_OPTIONS,
  JAKARTA_LOCATION_HUBS,
  KosFormSchema,
  extractCoordsFromGoogleMapsUrl,
  isValidGoogleMapsUrl,
  resolveLocationQuery,
} from '@kosmatch/shared';
import type { Kos, KosFormOutput, TipeKos } from '@kosmatch/shared';
import { useDeleteOwnerKos, useOwnerKos, useSaveOwnerKos } from '../api/hooks';
import { errorMessage } from '../api/client';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { cn } from '../lib/cn';
import { formatRating, formatRupiah, photoGradient } from '../lib/format';
import {
  DEFAULT_JAKARTA_LAT,
  DEFAULT_JAKARTA_LNG,
  OWNER_DESCRIPTION_TEMPLATES,
  OWNER_PRICE_PRESETS,
  computePortfolioMetrics,
  evaluateListingReadiness,
  isDefaultCoordinate,
} from '../lib/owner';
import { toast } from '../stores/toastStore';

/* ─── Owner Portfolio Management (/owner/kos) ─────────────────── */

type TypeFilter = 'semua' | TipeKos;
type OwnerSortKey = 'default' | 'harga_asc' | 'harga_desc' | 'rating_desc' | 'readiness_asc' | 'nama_asc';
type ViewMode = 'table' | 'grid';

const TIPE_META: Record<TipeKos, { label: string; desc: string }> = {
  putra: { label: 'Kos Putra', desc: 'Khusus penghuni pria' },
  putri: { label: 'Kos Putri', desc: 'Khusus penghuni wanita' },
  campur: { label: 'Kos Campur', desc: 'Pria & wanita (umum)' },
};

const FACILITY_ICONS: Record<(typeof FASILITAS_OPTIONS)[number], React.ReactNode> = {
  AC: <Wind size={15} />,
  WiFi: <Wifi size={15} />,
  'Kamar Mandi Dalam': <Bath size={15} />,
  'Dapur Bersama': <Utensils size={15} />,
  Parkir: <Car size={15} />,
  Laundry: <Shirt size={15} />,
};

export function OwnerDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: kosList = [], isLoading, isError, refetch } = useOwnerKos();
  const deleteKos = useDeleteOwnerKos();

  const [toDelete, setToDelete] = useState<Kos | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('semua');
  const [sortBy, setSortBy] = useState<OwnerSortKey>('default');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  const savedId = searchParams.get('saved');
  const savedKos = useMemo(() => (savedId ? kosList.find((k) => k.id === savedId) : undefined), [savedId, kosList]);
  const metrics = useMemo(() => computePortfolioMetrics(kosList), [kosList]);

  const filteredList = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = kosList.filter((k) => {
      if (typeFilter !== 'semua' && k.tipe !== typeFilter) return false;
      if (!q) return true;
      return (
        k.namaKos.toLowerCase().includes(q) ||
        k.area.toLowerCase().includes(q) ||
        k.fasilitas.some((f) => f.toLowerCase().includes(q))
      );
    });

    if (sortBy === 'default') return base;
    return [...base].sort((a, b) => {
      if (sortBy === 'harga_asc') return a.hargaSewa - b.hargaSewa;
      if (sortBy === 'harga_desc') return b.hargaSewa - a.hargaSewa;
      if (sortBy === 'rating_desc') return b.rating - a.rating;
      if (sortBy === 'readiness_asc') {
        return evaluateListingReadiness(a).score - evaluateListingReadiness(b).score;
      }
      return a.namaKos.localeCompare(b.namaKos, 'id', { sensitivity: 'base' });
    });
  }, [kosList, query, typeFilter, sortBy]);

  const dismissSavedBanner = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('saved');
    setSearchParams(next, { replace: true });
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteKos.mutateAsync(toDelete.id);
      toast.success(`"${toDelete.namaKos}" berhasil dihapus`);
      if (savedId === toDelete.id) dismissSavedBanner();
    } catch (e) {
      toast.error(errorMessage(e));
    }
    setToDelete(null);
  };

  return (
    <div className="page-container pb-16 pt-6 sm:pt-8">
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-accent">
            Manajemen Properti
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Kos Saya
          </h1>
          <p className="mt-1 text-sm text-muted">
            {metrics.total} properti · {metrics.readyCount} siap tayang
            {metrics.avgPrice ? ` · Rata-rata ${formatRupiah(metrics.avgPrice)}/bln` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Link to="/owner/kos/baru">
            <Button id="owner-add-kos" size="md" pill={false}>
              <Plus size={16} /> Tambah Kos Baru
            </Button>
          </Link>
        </div>
      </header>

      {/* Post-Save Confirmation Bar (keeps owner inside workspace while giving 1-click public preview) */}
      {savedKos && (
        <div
          data-testid="owner-saved-banner"
          className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="shrink-0 text-accent" />
            <p className="text-xs font-medium text-ink sm:text-sm">
              <span className="font-bold">{savedKos.namaKos}</span> berhasil disimpan dan sudah tayang untuk calon penyewa.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/kos/${savedKos.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-surface px-3 text-xs font-semibold text-ink border border-line transition hover:border-ink/30"
            >
              <Eye size={13} /> Lihat Halaman Publik
            </Link>
            <Link
              to="/owner/kos/baru"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-white transition hover:brightness-95"
            >
              <Plus size={13} /> Tambah Kos Lain
            </Link>
            <button
              type="button"
              onClick={dismissSavedBanner}
              aria-label="Tutup pemberitahuan"
              className="rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-ink"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Operational Filter & View Toolbar */}
      {kosList.length > 0 && (
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5 shadow-card lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama kos, kawasan, fasilitas..."
                aria-label="Cari properti kos saya"
                className="h-9 w-full rounded-lg border border-line bg-bg/50 pl-9 pr-8 text-xs text-ink placeholder:text-muted focus:border-accent focus:bg-surface focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-ink"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1">
              {(['semua', 'putra', 'putri', 'campur'] as TypeFilter[]).map((t) => {
                const count = t === 'semua' ? kosList.length : metrics.byType[t];
                const active = typeFilter === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTypeFilter(t)}
                    className={cn(
                      'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold capitalize transition',
                      active
                        ? 'bg-ink text-white'
                        : 'border border-line bg-surface text-muted hover:text-ink',
                    )}
                  >
                    <span>{t}</span>
                    <span className={cn('text-[10px] tabular-nums', active ? 'text-white/80' : 'text-muted')}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2.5 lg:justify-end">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as OwnerSortKey)}
              aria-label="Urutkan daftar kos"
              className="h-9 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink focus:border-accent focus:outline-none"
            >
              <option value="default">Urutan Default</option>
              <option value="harga_asc">Harga Termurah</option>
              <option value="harga_desc">Harga Termahal</option>
              <option value="rating_desc">Rating Tertinggi</option>
              <option value="readiness_asc">Perlu Dilengkapi Dulu</option>
              <option value="nama_asc">Nama A – Z</option>
            </select>

            <div className="hidden items-center rounded-lg border border-line bg-bg p-0.5 sm:flex" role="group" aria-label="Mode tampilan">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                aria-pressed={viewMode === 'table'}
                title="Tampilan tabel"
                className={cn(
                  'flex h-7 w-8 items-center justify-center rounded-md transition',
                  viewMode === 'table' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
                )}
              >
                <LayoutList size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
                title="Tampilan kartu"
                className={cn(
                  'flex h-7 w-8 items-center justify-center rounded-md transition',
                  viewMode === 'grid' ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink',
                )}
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Inventory View */}
      <div className="mt-5">
        {isError ? (
          <EmptyState
            title="Gagal memuat kos"
            action={<Button onClick={() => void refetch()}>Coba Lagi</Button>}
          />
        ) : isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-ink/5" />
            ))}
          </div>
        ) : kosList.length === 0 ? (
          <EmptyState
            title="Belum ada kos terdaftar"
            description="Tambahkan kos pertama Anda untuk mulai menerima calon penyewa."
            action={
              <Link to="/owner/kos/baru">
                <Button pill={false}>
                  <Plus size={16} /> Tambah Kos Pertama
                </Button>
              </Link>
            }
          />
        ) : filteredList.length === 0 ? (
          <EmptyState
            title="Tidak ada kos yang cocok"
            description="Coba ubah kata kunci pencarian atau filter tipe kos."
            action={
              <Button
                variant="outline"
                pill={false}
                onClick={() => {
                  setQuery('');
                  setTypeFilter('semua');
                }}
              >
                Reset Pencarian
              </Button>
            }
          />
        ) : viewMode === 'table' ? (
          <>
            {/* Desktop Operational Table */}
            <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface shadow-card md:block">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-line bg-bg/60 text-[11px] font-bold uppercase tracking-wider text-muted">
                    <th className="px-5 py-3">Properti &amp; Lokasi</th>
                    <th className="px-4 py-3">Tipe &amp; Fasilitas</th>
                    <th className="px-4 py-3">Tarif / Bulan</th>
                    <th className="px-4 py-3">Kelengkapan</th>
                    <th className="px-5 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-sm">
                  {filteredList.map((kos) => {
                    const readiness = evaluateListingReadiness(kos);
                    return (
                      <tr key={kos.id} className="transition hover:bg-bg/40">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-12 w-12 shrink-0 rounded-xl border border-line/60"
                              style={{ background: photoGradient(kos.fotoColor) }}
                              aria-hidden
                            />
                            <div className="min-w-0">
                              <Link
                                to={`/owner/kos/${kos.id}/edit`}
                                className="block max-w-[260px] truncate font-bold text-ink hover:text-primary"
                              >
                                {kos.namaKos}
                              </Link>
                              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                                <span className="truncate max-w-[200px]">{kos.area}</span>
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold',
                                    kos.googleMapsUrl
                                      ? 'bg-accent/15 text-ink'
                                      : readiness.isDefaultCoords
                                        ? 'bg-primary/10 text-primary'
                                        : 'bg-bg text-muted',
                                  )}
                                >
                                  {kos.googleMapsUrl ? (
                                    <>
                                      <Link2 size={10} className="text-accent" />
                                      Link Maps
                                    </>
                                  ) : (
                                    <>
                                      <MapPin size={10} />
                                      {readiness.isDefaultCoords ? 'Pin default' : 'Pin terkunci'}
                                    </>
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="inline-block rounded-md border border-line bg-bg px-2 py-0.5 text-[11px] font-semibold capitalize text-ink">
                            Kos {kos.tipe}
                          </span>
                          <p className="mt-1 max-w-[200px] truncate text-xs text-muted">
                            {kos.fasilitas.slice(0, 3).join(', ')}
                            {kos.fasilitas.length > 3 ? ` +${kos.fasilitas.length - 3}` : ''}
                          </p>
                        </td>

                        <td className="px-4 py-3.5 tabular-nums">
                          <p className="font-extrabold text-primary">{formatRupiah(kos.hargaSewa)}</p>
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted">
                            <Star size={11} className="fill-primary text-primary" />
                            {formatRating(kos.rating)}
                          </p>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="w-32">
                            <div className="flex items-center justify-between text-[11px] font-semibold">
                              <span className={readiness.score >= 80 ? 'text-ink' : 'text-primary'}>
                                {readiness.label}
                              </span>
                              <span className="tabular-nums text-muted">{readiness.score}%</span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-bg">
                              <div
                                className={cn(
                                  'h-full rounded-full transition-all',
                                  readiness.score >= 80 ? 'bg-accent' : 'bg-primary',
                                )}
                                style={{ width: `${readiness.score}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <Link
                              to={`/owner/kos/${kos.id}/edit`}
                              className="inline-flex h-8 items-center gap-1 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-ink transition hover:border-ink/30 hover:bg-bg"
                            >
                              <Edit2 size={12} /> Ubah
                            </Link>
                            <Link
                              to={`/owner/kos/baru?from=${encodeURIComponent(kos.id)}`}
                              title="Duplikat kos"
                              aria-label={`Duplikat ${kos.namaKos}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:border-ink/30 hover:bg-bg hover:text-ink"
                            >
                              <Copy size={13} />
                            </Link>
                            <Link
                              to={`/kos/${kos.id}`}
                              title="Lihat halaman publik"
                              aria-label={`Lihat ${kos.namaKos}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:border-ink/30 hover:bg-bg hover:text-ink"
                            >
                              <Eye size={13} />
                            </Link>
                            <button
                              type="button"
                              aria-label={`Hapus ${kos.namaKos}`}
                              title="Hapus kos"
                              onClick={() => setToDelete(kos)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-bahaya transition hover:border-bahaya/40 hover:bg-bahaya/10"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Fallback when viewMode === 'table' */}
            <div className="space-y-3 md:hidden">
              {filteredList.map((kos) => (
                <OwnerPropertyCard key={kos.id} kos={kos} onDelete={setToDelete} />
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredList.map((kos) => (
              <OwnerPropertyCard key={kos.id} kos={kos} onDelete={setToDelete} />
            ))}
          </div>
        )}
      </div>

      <Modal open={!!toDelete} title="Hapus Properti Kos" onClose={() => setToDelete(null)}>
        <p className="text-sm leading-relaxed text-muted">
          Yakin ingin menghapus <span className="font-bold text-ink">{toDelete?.namaKos}</span>? Properti ini akan segera dihapus dari hasil pencarian penyewa dan tidak dapat dikembalikan.
        </p>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="outline" pill={false} onClick={() => setToDelete(null)}>
            Batal
          </Button>
          <Button
            variant="danger"
            pill={false}
            onClick={() => void handleDelete()}
            loading={deleteKos.isPending}
          >
            Ya, Hapus Kos
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function OwnerPropertyCard({ kos, onDelete }: { kos: Kos; onDelete: (k: Kos) => void }) {
  const readiness = evaluateListingReadiness(kos);
  return (
    <Card className="flex flex-col justify-between rounded-2xl p-4 transition hover:border-ink/20 hover:shadow-float">
      <div>
        <div className="flex items-start gap-3">
          <div
            className="h-14 w-14 shrink-0 rounded-xl border border-line/60"
            style={{ background: photoGradient(kos.fotoColor) }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-md border border-line bg-bg px-2 py-0.5 text-[10px] font-semibold capitalize text-ink">
                Kos {kos.tipe}
              </span>
              <span className="inline-flex items-center gap-0.5 text-xs font-bold text-ink">
                <Star size={11} className="fill-primary text-primary" /> {formatRating(kos.rating)}
              </span>
            </div>
            <h3 className="mt-1 truncate text-sm font-bold text-ink">{kos.namaKos}</h3>
            <p className="truncate text-xs text-muted">{kos.area}</p>
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between border-t border-line/70 pt-3">
          <p className="text-base font-extrabold tabular-nums text-primary">
            {formatRupiah(kos.hargaSewa)}
            <span className="text-xs font-medium text-muted"> /bln</span>
          </p>
          <span
            className={cn(
              'rounded-md px-2 py-0.5 text-[10px] font-semibold',
              readiness.score >= 80 ? 'bg-accent/15 text-ink' : 'bg-primary/10 text-primary',
            )}
          >
            {readiness.label} · {readiness.score}%
          </span>
        </div>
      </div>

      <div className="mt-3.5 flex items-center gap-1.5 border-t border-line/70 pt-3">
        <Link
          to={`/owner/kos/${kos.id}/edit`}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-surface text-xs font-semibold text-ink transition hover:bg-bg"
        >
          <Edit2 size={12} /> Ubah
        </Link>
        <Link
          to={`/owner/kos/baru?from=${encodeURIComponent(kos.id)}`}
          title="Duplikat kos"
          aria-label={`Duplikat ${kos.namaKos}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:bg-bg hover:text-ink"
        >
          <Copy size={13} />
        </Link>
        <Link
          to={`/kos/${kos.id}`}
          title="Lihat halaman publik"
          aria-label={`Lihat ${kos.namaKos}`}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:bg-bg hover:text-ink"
        >
          <Eye size={13} />
        </Link>
        <button
          type="button"
          aria-label={`Hapus ${kos.namaKos}`}
          onClick={() => onDelete(kos)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-bahaya transition hover:bg-bahaya/10"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </Card>
  );
}

/* ─── Owner Listing Studio Editor (/owner/kos/baru & /:id/edit) ─ */

type FormValues = {
  namaKos: string;
  area: string;
  hargaSewa: number;
  latitude: number;
  longitude: number;
  googleMapsUrl?: string;
  tipe: TipeKos;
  fasilitas: Array<(typeof FASILITAS_OPTIONS)[number]>;
  deskripsi: string;
};

export function OwnerKosFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const duplicateFromId = !isEdit ? searchParams.get('from') : null;

  const { data: kosList = [], isLoading: loadingOwnerKos } = useOwnerKos();
  const existing = useMemo(() => (id ? kosList.find((k) => k.id === id) : undefined), [id, kosList]);
  const duplicateSource = useMemo(
    () => (duplicateFromId ? kosList.find((k) => k.id === duplicateFromId) : undefined),
    [duplicateFromId, kosList],
  );
  const save = useSaveOwnerKos(id);

  const [areaQuery, setAreaQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [submitTarget, setSubmitTarget] = useState<'manage' | 'preview'>('manage');
  const hydratedKeyRef = useRef<string | null>(null);
  const suggestionBoxRef = useRef<HTMLDivElement>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(KosFormSchema),
    defaultValues: {
      namaKos: '',
      area: '',
      hargaSewa: 1500000,
      latitude: DEFAULT_JAKARTA_LAT,
      longitude: DEFAULT_JAKARTA_LNG,
      googleMapsUrl: '',
      tipe: 'campur',
      fasilitas: ['WiFi'],
      deskripsi: '',
    },
  });

  // Hydrate form reliably after useOwnerKos() finishes loading (fixes reload bug on /edit and ?from= duplicate)
  useEffect(() => {
    const source = isEdit ? existing : duplicateSource;
    const key = isEdit ? `edit:${existing?.id ?? ''}` : duplicateSource ? `dup:${duplicateSource.id}` : 'new';
    if (!source || hydratedKeyRef.current === key) return;

    const validFacilities = source.fasilitas.filter((f): f is (typeof FASILITAS_OPTIONS)[number] =>
      (FASILITAS_OPTIONS as readonly string[]).includes(f),
    );

    form.reset({
      namaKos: isEdit ? source.namaKos : `${source.namaKos} (Baru)`,
      area: source.area,
      hargaSewa: source.hargaSewa,
      latitude: source.latitude,
      longitude: source.longitude,
      googleMapsUrl: source.googleMapsUrl ?? '',
      tipe: source.tipe,
      fasilitas: validFacilities.length > 0 ? validFacilities : ['WiFi'],
      deskripsi: source.deskripsi,
    });
    setAreaQuery(source.area);
    hydratedKeyRef.current = key;
  }, [isEdit, existing, duplicateSource, form]);

  // Close area dropdown cleanly when clicking outside
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (suggestionBoxRef.current && !suggestionBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const watched = form.watch();
  const safeLat = Number.isFinite(watched.latitude) ? Number(watched.latitude) : DEFAULT_JAKARTA_LAT;
  const safeLng = Number.isFinite(watched.longitude) ? Number(watched.longitude) : DEFAULT_JAKARTA_LNG;
  const safeHarga = Number.isFinite(watched.hargaSewa) ? Number(watched.hargaSewa) : 0;
  const trimmedMapsUrl = (watched.googleMapsUrl ?? '').trim();
  const hasValidMapsUrl = trimmedMapsUrl.length > 0 && isValidGoogleMapsUrl(trimmedMapsUrl);

  const readiness = useMemo(
    () =>
      evaluateListingReadiness({
        namaKos: watched.namaKos ?? '',
        area: watched.area ?? '',
        hargaSewa: safeHarga,
        latitude: safeLat,
        longitude: safeLng,
        googleMapsUrl: trimmedMapsUrl || undefined,
        fasilitas: watched.fasilitas ?? [],
        deskripsi: watched.deskripsi ?? '',
      }),
    [watched.namaKos, watched.area, safeHarga, safeLat, safeLng, trimmedMapsUrl, watched.fasilitas, watched.deskripsi],
  );

  const locationSuggestions = useMemo(() => {
    const q = areaQuery.trim().toLowerCase();
    if (!q) return JAKARTA_LOCATION_HUBS.slice(0, 6);
    return JAKARTA_LOCATION_HUBS.filter(
      (hub) =>
        hub.name.toLowerCase().includes(q) ||
        hub.region.toLowerCase().includes(q) ||
        hub.aliases.some((a) => a.toLowerCase().includes(q)) ||
        hub.nearbyAreas.some((a) => a.toLowerCase().includes(q)),
    ).slice(0, 6);
  }, [areaQuery]);

  // Smart fallback: detect hub even if owner typed free text without picking dropdown
  const autoDetectedHub = useMemo(() => {
    if (!areaQuery.trim() || !isDefaultCoordinate(safeLat, safeLng)) return null;
    return resolveLocationQuery(areaQuery);
  }, [areaQuery, safeLat, safeLng]);

  const selectHub = (hub: (typeof JAKARTA_LOCATION_HUBS)[number]) => {
    const areaLabel = `${hub.name}, ${hub.region}`;
    setAreaQuery(areaLabel);
    form.setValue('area', areaLabel, { shouldValidate: true });
    form.setValue('latitude', hub.latitude, { shouldValidate: true });
    form.setValue('longitude', hub.longitude, { shouldValidate: true });
    setShowSuggestions(false);
    toast.success(`Koordinat terkunci ke kawasan ${hub.name}`);
  };

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      toast.error('Browser tidak mendukung deteksi lokasi GPS');
      return;
    }
    setLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        form.setValue('latitude', lat, { shouldValidate: true });
        form.setValue('longitude', lng, { shouldValidate: true });
        setLocatingGps(false);
        toast.success('Koordinat berhasil diambil dari GPS perangkat');
      },
      () => {
        setLocatingGps(false);
        toast.error('Izin lokasi ditolak atau gagal mendeteksi GPS');
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const handleGoogleMapsUrlChange = (rawValue: string) => {
    form.setValue('googleMapsUrl', rawValue, { shouldValidate: true });
    const extracted = extractCoordsFromGoogleMapsUrl(rawValue);
    if (extracted) {
      form.setValue('latitude', extracted.latitude, { shouldValidate: true });
      form.setValue('longitude', extracted.longitude, { shouldValidate: true });
      toast.success('Koordinat otomatis diambil dari tautan Google Maps');
    }
  };

  const appendTemplate = (snippet: string) => {
    const current = (form.getValues('deskripsi') ?? '').trim();
    const next = current ? `${current}\n${snippet}` : snippet;
    form.setValue('deskripsi', next.slice(0, 1000), { shouldValidate: true });
  };

  const onSubmit = async (values: FormValues) => {
    try {
      const result = await save.mutateAsync(values as KosFormOutput);
      toast.success(isEdit ? 'Perubahan kos berhasil disimpan' : 'Kos baru berhasil ditambahkan');
      if (submitTarget === 'preview') {
        navigate(`/kos/${result.id}`);
      } else {
        navigate(`/owner/kos?saved=${encodeURIComponent(result.id)}`);
      }
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  if (isEdit && loadingOwnerKos && !existing) {
    return (
      <div className="page-container py-8">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-ink/10" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="h-[520px] animate-pulse rounded-2xl bg-ink/5" />
          <div className="h-80 animate-pulse rounded-2xl bg-ink/5" />
        </div>
      </div>
    );
  }

  if (isEdit && !loadingOwnerKos && !existing) {
    return (
      <div className="page-container py-12">
        <EmptyState
          title="Kos tidak ditemukan di akun Anda"
          description="Properti mungkin sudah dihapus atau bukan milik akun pemilik ini."
          action={
            <Link to="/owner/kos">
              <Button pill={false}>Kembali ke Kos Saya</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const googleMapsPinUrl = hasValidMapsUrl
    ? trimmedMapsUrl
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${safeLat},${safeLng}`)}`;
  const previewColor = existing?.fotoColor ?? duplicateSource?.fotoColor ?? '#76ABAE';
  const descLength = (watched.deskripsi ?? '').length;

  return (
    <div className="page-container pb-16 pt-6 sm:pt-8">
      {/* Studio Breadcrumb & Header */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
        <div>
          <Link
            to="/owner/kos"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition hover:text-ink"
          >
            <ArrowLeft size={14} /> Kembali ke Kos Saya
          </Link>
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-ink">
            {isEdit ? `Ubah Properti: ${existing?.namaKos}` : duplicateSource ? 'Duplikat & Tambah Kos Baru' : 'Tambah Properti Kos Baru'}
          </h1>
          <p className="mt-1 text-xs text-muted sm:text-sm">
            Isi 4 bagian ringkas di bawah ini — pratinjau tampilan calon penyewa akan diperbarui secara langsung.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-bold tabular-nums',
              readiness.score >= 80
                ? 'border-accent/40 bg-accent/15 text-ink'
                : 'border-primary/30 bg-primary/10 text-primary',
            )}
          >
            Kelengkapan {readiness.score}% · {readiness.label}
          </span>
        </div>
      </header>

      {duplicateSource && (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-xs text-ink">
          <Copy size={15} className="shrink-0 text-accent" />
          <span>
            Menyalin data dari <strong>{duplicateSource.namaKos}</strong>. Ubah nama, harga, atau lokasi seperlunya lalu simpan sebagai properti baru.
          </span>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        {/* LEFT: 4 Structured Studio Form Sections */}
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
          {/* 01. Identitas & Tipe Hunian */}
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
            <div className="mb-4 flex items-center gap-2.5 border-b border-line pb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-[11px] font-bold text-white">
                01
              </span>
              <h2 className="text-sm font-bold text-ink">Identitas &amp; Tipe Hunian</h2>
            </div>

            <div className="space-y-4">
              <Input
                label="Nama Properti Kos"
                placeholder="mis. Kos Melati Kemang Selatan"
                error={form.formState.errors.namaKos?.message}
                {...form.register('namaKos')}
              />

              <Controller
                control={form.control}
                name="tipe"
                render={({ field, fieldState }) => (
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-ink">Tipe Penghuni</p>
                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      {(['putra', 'putri', 'campur'] as TipeKos[]).map((t) => {
                        const selected = field.value === t;
                        return (
                          <button
                            key={t}
                            type="button"
                            onClick={() => field.onChange(t)}
                            aria-pressed={selected}
                            className={cn(
                              'flex flex-col items-start rounded-xl border p-3 text-left transition',
                              selected
                                ? 'border-primary bg-primary/10 text-ink'
                                : 'border-line bg-bg/40 text-ink hover:border-ink/30 hover:bg-bg',
                            )}
                          >
                            <div className="flex w-full items-center justify-between">
                              <span className="flex items-center gap-1.5 text-xs font-bold">
                                <Users size={13} className={selected ? 'text-primary' : 'text-muted'} />
                                {TIPE_META[t].label}
                              </span>
                              {selected && <Check size={14} className="text-primary" />}
                            </div>
                            <span className="mt-1 text-[11px] text-muted">{TIPE_META[t].desc}</span>
                          </button>
                        );
                      })}
                    </div>
                    {fieldState.error && (
                      <p role="alert" className="mt-1 text-xs text-bahaya">
                        {fieldState.error.message}
                      </p>
                    )}
                  </div>
                )}
              />
            </div>
          </section>

          {/* 02. Lokasi & Penguncian Pin */}
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
            <div className="mb-4 flex items-center gap-2.5 border-b border-line pb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-[11px] font-bold text-white">
                02
              </span>
              <h2 className="text-sm font-bold text-ink">Lokasi &amp; Akurasi Pin Peta</h2>
            </div>

            <div className="space-y-3.5">
              <div className="relative" ref={suggestionBoxRef}>
                <Input
                  label="Kawasan / Area Kos"
                  placeholder="Ketik kawasan (mis. TB Simatupang, Kemang, Tebet, Depok)"
                  value={areaQuery}
                  error={form.formState.errors.area?.message}
                  onChange={(e) => {
                    setAreaQuery(e.target.value);
                    form.setValue('area', e.target.value, { shouldValidate: true });
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                />

                {showSuggestions && locationSuggestions.length > 0 && (
                  <ul className="absolute z-20 mt-1.5 max-h-60 w-full overflow-auto rounded-xl border border-line bg-surface p-1.5 shadow-float">
                    {locationSuggestions.map((hub) => (
                      <li key={hub.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectHub(hub);
                          }}
                          className="flex w-full flex-col items-start rounded-lg px-3 py-2 text-left transition hover:bg-bg"
                        >
                          <span className="flex items-center gap-1.5 text-xs font-bold text-ink">
                            <MapPin size={13} className="text-primary" /> {hub.name}
                          </span>
                          <span className="text-[11px] text-muted">
                            {hub.region} · Sekitar: {hub.nearbyAreas.slice(0, 3).join(', ')}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Smart 1-click coordinate lock if owner typed free text */}
              {autoDetectedHub && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2.5 text-xs">
                  <span className="text-ink">
                    Kawasan <strong>{autoDetectedHub.displayName}</strong> terdeteksi. Kunci pin koordinat otomatis?
                  </span>
                  <button
                    type="button"
                    onClick={() => selectHub(autoDetectedHub.hub)}
                    className="rounded-lg bg-primary px-3 py-1 text-[11px] font-bold text-white transition hover:brightness-95"
                  >
                    Kunci Koordinat
                  </button>
                </div>
              )}

              {/* Share Link Google Maps untuk Hyperlink Penyewa */}
              <div className="rounded-xl border border-line bg-bg/40 p-3.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label htmlFor="owner-google-maps-url" className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <Link2 size={14} className="text-accent" />
                    Tautan Share Google Maps (Opsional)
                  </label>
                  {hasValidMapsUrl && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-ink">
                      <Check size={11} className="text-accent" /> Dipakai di halaman penyewa
                    </span>
                  )}
                </div>
                <p className="mb-2 text-[11px] leading-relaxed text-muted">
                  Buka Google Maps → pilih titik kos → tekan <strong>Bagikan</strong> → <strong>Salin link</strong>, lalu tempel di sini. Tautan ini akan langsung dipakai untuk tombol Google Maps pada tampilan penyewa.
                </p>
                <div className="relative flex items-center">
                  <input
                    id="owner-google-maps-url"
                    type="url"
                    value={watched.googleMapsUrl ?? ''}
                    onChange={(e) => handleGoogleMapsUrlChange(e.target.value)}
                    placeholder="https://maps.app.goo.gl/... atau https://www.google.com/maps/..."
                    aria-invalid={!!form.formState.errors.googleMapsUrl}
                    className={cn(
                      'w-full rounded-xl border bg-surface px-3.5 py-2.5 pr-9 text-sm text-ink transition placeholder:text-muted/70 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20',
                      form.formState.errors.googleMapsUrl ? 'border-bahaya' : 'border-line',
                    )}
                  />
                  {watched.googleMapsUrl && (
                    <button
                      type="button"
                      onClick={() => form.setValue('googleMapsUrl', '', { shouldValidate: true })}
                      aria-label="Hapus tautan Google Maps"
                      className="absolute right-2.5 rounded-md p-1 text-muted transition hover:bg-bg hover:text-ink"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                {form.formState.errors.googleMapsUrl && (
                  <p role="alert" className="mt-1.5 text-xs text-bahaya">
                    {form.formState.errors.googleMapsUrl.message}
                  </p>
                )}
              </div>

              {/* Coordinate Status + GPS + Verify Maps Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-bg/50 px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      'inline-block h-2.5 w-2.5 shrink-0 rounded-full',
                      readiness.isDefaultCoords && !hasValidMapsUrl ? 'bg-primary' : 'bg-sukses',
                    )}
                  />
                  <div>
                    <p className="font-semibold text-ink">
                      {hasValidMapsUrl
                        ? 'Tautan Google Maps & titik lokasi siap'
                        : readiness.isDefaultCoords
                          ? 'Koordinat masih default Jakarta'
                          : 'Pin koordinat terkunci'}
                    </p>
                    <p className="font-mono text-[11px] text-muted">
                      {safeLat.toFixed(4)}, {safeLng.toFixed(4)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUseGps}
                    disabled={locatingGps}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-ink transition hover:border-ink/30 hover:bg-bg disabled:opacity-50"
                  >
                    <Crosshair size={13} className="text-accent" />
                    {locatingGps ? 'Mendeteksi...' : 'GPS Saya'}
                  </button>
                  <a
                    href={googleMapsPinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-ink transition hover:border-ink/30 hover:bg-bg"
                  >
                    {hasValidMapsUrl ? 'Buka Link Maps' : 'Cek di Maps'} <ExternalLink size={12} className="text-muted" />
                  </a>
                </div>
              </div>

              <details className="rounded-xl border border-line/80 bg-bg/30 p-3 text-xs">
                <summary className="cursor-pointer font-semibold text-muted hover:text-ink">
                  Sesuaikan Latitude &amp; Longitude Manual (Opsional)
                </summary>
                <p className="mt-1 text-[11px] text-muted">
                  Jika ingin pin persis di depan gerbang kos, salin koordinat dari Google Maps dan tempel di sini.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Input
                    label="Latitude"
                    type="number"
                    step="0.0001"
                    placeholder="-6.2088"
                    error={form.formState.errors.latitude?.message}
                    {...form.register('latitude', { valueAsNumber: true })}
                  />
                  <Input
                    label="Longitude"
                    type="number"
                    step="0.0001"
                    placeholder="106.8456"
                    error={form.formState.errors.longitude?.message}
                    {...form.register('longitude', { valueAsNumber: true })}
                  />
                </div>
              </details>
            </div>
          </section>

          {/* 03. Tarif Sewa & Fasilitas */}
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
            <div className="mb-4 flex items-center gap-2.5 border-b border-line pb-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-[11px] font-bold text-white">
                03
              </span>
              <h2 className="text-sm font-bold text-ink">Tarif Sewa &amp; Fasilitas</h2>
            </div>

            <div className="space-y-5">
              <div>
                <div className="flex items-end justify-between gap-2">
                  <div className="flex-1">
                    <Input
                      label="Harga Sewa per Bulan (Rp)"
                      type="number"
                      placeholder="mis. 1800000"
                      error={form.formState.errors.hargaSewa?.message}
                      {...form.register('hargaSewa', { valueAsNumber: true })}
                    />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium text-muted">Preset cepat:</span>
                    {OWNER_PRICE_PRESETS.map((preset) => (
                      <button
                        key={preset.value}
                        type="button"
                        onClick={() => form.setValue('hargaSewa', preset.value, { shouldValidate: true })}
                        className={cn(
                          'rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition',
                          safeHarga === preset.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-line bg-bg/60 text-ink hover:border-ink/30',
                        )}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  {safeHarga >= 100000 && (
                    <span className="text-xs font-bold tabular-nums text-primary">
                      {formatRupiah(safeHarga)} / bulan
                    </span>
                  )}
                </div>
              </div>

              <Controller
                control={form.control}
                name="fasilitas"
                render={({ field, fieldState }) => {
                  const allSelected = field.value.length === FASILITAS_OPTIONS.length;
                  return (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium text-ink">
                          Fasilitas Tersedia{' '}
                          <span className="text-xs font-normal text-muted">({field.value.length} dipilih)</span>
                        </p>
                        <button
                          type="button"
                          onClick={() => field.onChange(allSelected ? [] : [...FASILITAS_OPTIONS])}
                          className="text-xs font-semibold text-accent hover:underline"
                        >
                          {allSelected ? 'Kosongkan' : 'Pilih Semua'}
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {FASILITAS_OPTIONS.map((f) => {
                          const checked = field.value.includes(f);
                          return (
                            <button
                              key={f}
                              type="button"
                              aria-pressed={checked}
                              onClick={() =>
                                field.onChange(
                                  checked ? field.value.filter((x) => x !== f) : [...field.value, f],
                                )
                              }
                              className={cn(
                                'flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition',
                                checked
                                  ? 'border-accent bg-accent/15 text-ink'
                                  : 'border-line bg-bg/40 text-muted hover:border-ink/30 hover:text-ink',
                              )}
                            >
                              <span className={checked ? 'text-accent' : 'text-muted'}>{FACILITY_ICONS[f]}</span>
                              <span className="truncate">{f}</span>
                            </button>
                          );
                        })}
                      </div>
                      {fieldState.error && (
                        <p role="alert" className="mt-1.5 text-xs text-bahaya">
                          {fieldState.error.message}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
            </div>
          </section>

          {/* 04. Deskripsi & Aturan Kos */}
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
            <div className="mb-4 flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-ink text-[11px] font-bold text-white">
                  04
                </span>
                <h2 className="text-sm font-bold text-ink">Deskripsi &amp; Aturan Kos</h2>
              </div>
              <span className="text-[11px] tabular-nums text-muted">{descLength} / 1000</span>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-muted">Sisipkan template cepat:</span>
              {OWNER_DESCRIPTION_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => appendTemplate(tpl.text)}
                  className="rounded-lg border border-line bg-bg/60 px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:border-accent hover:bg-accent/10"
                >
                  + {tpl.label}
                </button>
              ))}
            </div>

            <Textarea
              label="Deskripsi Lengkap"
              placeholder="Ceritakan keunggulan lokasi, jarak ke stasiun/kampus, info listrik, dan jam bertamu..."
              error={form.formState.errors.deskripsi?.message}
              {...form.register('deskripsi')}
            />
          </section>

          {/* Sticky Operational Submit Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
            <Link to="/owner/kos">
              <Button type="button" variant="ghost" pill={false}>
                Batal
              </Button>
            </Link>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="submit"
                variant="outline"
                pill={false}
                loading={save.isPending && submitTarget === 'preview'}
                onClick={() => setSubmitTarget('preview')}
              >
                <Eye size={14} /> Simpan &amp; Lihat Publik
              </Button>
              <Button
                type="submit"
                pill={false}
                loading={save.isPending && submitTarget === 'manage'}
                onClick={() => setSubmitTarget('manage')}
              >
                {isEdit ? 'Simpan Perubahan' : 'Simpan & Tayangkan'}
              </Button>
            </div>
          </div>
        </form>

        {/* RIGHT: Sticky Live Tenant Preview & Readiness Studio */}
        <aside className="space-y-5 lg:sticky lg:top-20">
          {/* Listing Readiness Checklist */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-ink">Kesiapan Listing</h2>
              <span className="text-sm font-extrabold tabular-nums text-primary">{readiness.score}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-bg">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  readiness.score >= 80 ? 'bg-accent' : 'bg-primary',
                )}
                style={{ width: `${readiness.score}%` }}
              />
            </div>

            <ul className="mt-4 space-y-2.5">
              {readiness.checks.map((item) => (
                <li key={item.id} className="flex items-start gap-2.5 text-xs">
                  {item.done ? (
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-sukses" />
                  ) : (
                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-muted" />
                  )}
                  <div className="min-w-0">
                    <p className={cn('font-semibold', item.done ? 'text-ink' : 'text-muted')}>
                      {item.label}
                    </p>
                    {!item.done && <p className="mt-0.5 text-[11px] leading-snug text-muted">{item.hint}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Real-Time Tenant Card Preview */}
          <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
              Pratinjau Tampilan Penyewa
            </p>
            <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface p-2.5 shadow-sm">
              <div
                className="relative aspect-[4/3] w-full overflow-hidden rounded-xl"
                style={{ background: photoGradient(previewColor) }}
              >
                <span className="absolute left-2.5 top-2.5 rounded-full bg-surface/95 px-2.5 py-0.5 text-[10px] font-bold capitalize text-ink shadow-sm">
                  Kos {watched.tipe || 'campur'}
                </span>
                <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-surface/95 px-2 py-0.5 text-[10px] font-bold text-ink shadow-sm">
                  <Star size={10} className="fill-primary text-primary" />
                  {existing ? formatRating(existing.rating) : 'Baru'}
                </span>
              </div>
              <div className="space-y-1.5 px-1.5 pb-1 pt-3">
                <h3 className="truncate text-sm font-extrabold text-ink">
                  {watched.namaKos?.trim() || 'Nama Kos Anda'}
                </h3>
                <p className="flex items-center gap-1 text-xs text-muted">
                  <MapPin size={12} className="shrink-0 text-accent" />
                  <span className="truncate">{watched.area?.trim() || 'Kawasan kos belum dipilih'}</span>
                </p>
                {(watched.fasilitas ?? []).length > 0 && (
                  <p className="truncate text-[11px] text-muted">
                    {(watched.fasilitas ?? []).slice(0, 3).join(' · ')}
                    {(watched.fasilitas ?? []).length > 3 ? ` · +${(watched.fasilitas ?? []).length - 3}` : ''}
                  </p>
                )}
                <p className="pt-1">
                  <span className="text-base font-extrabold tabular-nums text-primary">
                    {safeHarga >= 100000 ? formatRupiah(safeHarga) : 'Rp 0'}
                  </span>{' '}
                  <span className="text-[11px] text-muted">/bulan</span>
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
