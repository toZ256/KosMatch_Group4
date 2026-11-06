import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  ChevronLeft,
  ChevronRight,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { KosWithCommute } from '@kosmatch/shared';
import { useDestinations, useKosList } from '../api/hooks';
import { KosCard, KosCardSkeleton } from '../components/kos/KosCard';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Select } from '../components/ui/Input';
import { formatRupiah } from '../lib/format';
import {
  BUDGET_RANGES,
  COMMUTE_OPTIONS,
  FACILITY_FILTER_OPTIONS,
  MAX_PRICE_OPTIONS,
  getPaginationPages,
  kosHasFilteredFacility,
} from '../lib/search';

const PAGE_SIZE = 12;

type SortKey = 'default' | 'harga' | 'waktu_ojek' | 'waktu_transit' | 'rating' | 'nama';
type SortDir = 'asc' | 'desc';

function sortKosList(list: KosWithCommute[], sortBy: SortKey, sortDir: SortDir): KosWithCommute[] {
  if (sortBy === 'default') return list;

  return [...list].sort((a, b) => {
    let diff = 0;
    if (sortBy === 'harga') {
      diff = a.hargaSewa - b.hargaSewa;
    } else if (sortBy === 'waktu_ojek') {
      const aOjek = a.commute?.find((c) => c.mode === 'ojek')?.durationMin ?? Infinity;
      const bOjek = b.commute?.find((c) => c.mode === 'ojek')?.durationMin ?? Infinity;
      diff = aOjek - bOjek;
    } else if (sortBy === 'waktu_transit') {
      const aTransit = a.commute?.find((c) => c.mode === 'transit')?.durationMin ?? Infinity;
      const bTransit = b.commute?.find((c) => c.mode === 'transit')?.durationMin ?? Infinity;
      diff = aTransit - bTransit;
    } else if (sortBy === 'rating') {
      diff = a.rating - b.rating;
    } else if (sortBy === 'nama') {
      diff = a.namaKos.localeCompare(b.namaKos, 'id', { sensitivity: 'base' });
    }
    return sortDir === 'asc' ? diff : -diff;
  });
}

function getSortDirLabel(sortBy: SortKey, sortDir: SortDir): string {
  if (sortBy === 'harga') return sortDir === 'asc' ? 'Termurah' : 'Termahal';
  if (sortBy === 'waktu_ojek' || sortBy === 'waktu_transit') {
    return sortDir === 'asc' ? 'Tercepat' : 'Terlama';
  }
  if (sortBy === 'rating') return sortDir === 'asc' ? 'Terendah' : 'Tertinggi';
  if (sortBy === 'nama') return sortDir === 'asc' ? 'A - Z' : 'Z - A';
  return sortDir === 'asc' ? 'Menaik' : 'Menurun';
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: destinations = [] } = useDestinations();
  const resultsTopRef = useRef<HTMLDivElement>(null);

  const destinationId = params.get('destinationId') ?? '';
  const commuteMotor = Number(params.get('commuteMotor')) || undefined;
  const commuteTransit = Number(params.get('commuteTransit')) || undefined;
  // Fallback for legacy commute query param
  const maxCommuteLegacy = Number(params.get('maxCommuteMin')) || undefined;

  // Single price filter: maxPriceParam (with fallback to legacy budget)
  const legacyBudget = BUDGET_RANGES.find((b) => b.value === params.get('budget'));
  const maxPriceParam = Number(params.get('maxPrice')) || legacyBudget?.max || undefined;

  const tipe = params.get('tipe') ?? '';
  const q = params.get('q') ?? '';

  // Current page from URL params (defaults to 1)
  const rawPage = Number(params.get('page')) || 1;
  const currentPage = Math.max(1, rawPage);

  // Sort parameters from URL
  const sortBy = (params.get('sortBy') as SortKey) || 'default';
  const sortDir = (params.get('sortDir') as SortDir) || (sortBy === 'rating' ? 'desc' : 'asc');

  // Facilities filter: comma-separated list of IDs in URL
  const fasilitasParam = params.get('fasilitas') ?? '';
  const selectedFacilities = useMemo(
    () => (fasilitasParam ? fasilitasParam.split(',').filter(Boolean) : []),
    [fasilitasParam],
  );

  // Local state for top search bar input
  const [searchInput, setSearchInput] = useState(q);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const { data, isLoading, isError, refetch } = useKosList({
    destinationId: destinationId || undefined,
    maxPrice: maxPriceParam,
    tipe: tipe || undefined,
    q: q || undefined,
  });

  const filteredResults = useMemo(
    () =>
      (data ?? []).filter((k) => {
        // Commute filtering: only evaluated when destinationId is set
        if (destinationId) {
          // Motor / Ojek filter
          if (commuteMotor) {
            const ojek = k.commute?.find((c) => c.mode === 'ojek');
            if (!ojek || ojek.durationMin > commuteMotor) return false;
          }
          // Transit / Kereta filter
          if (commuteTransit) {
            const transit = k.commute?.find((c) => c.mode === 'transit');
            if (!transit || transit.durationMin > commuteTransit) return false;
          }
          // Legacy generic commute cap
          if (maxCommuteLegacy && !commuteMotor && !commuteTransit) {
            const bestMin = k.commute ? Math.min(...k.commute.map((c) => c.durationMin)) : Infinity;
            if (bestMin > maxCommuteLegacy) return false;
          }
        }

        // Facilities filter: kos must satisfy all selected facilities
        if (selectedFacilities.length > 0) {
          const hasAll = selectedFacilities.every((facId) => kosHasFilteredFacility(k, facId));
          if (!hasAll) return false;
        }

        return true;
      }),
    [data, destinationId, commuteMotor, commuteTransit, maxCommuteLegacy, selectedFacilities],
  );

  // Apply sorting on filtered results
  const results = useMemo(
    () => sortKosList(filteredResults, sortBy, sortDir),
    [filteredResults, sortBy, sortDir],
  );

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  const visibleResults = useMemo(() => {
    const startIndex = (safePage - 1) * PAGE_SIZE;
    return results.slice(startIndex, startIndex + PAGE_SIZE);
  }, [results, safePage]);

  const paginationPages = useMemo(
    () => getPaginationPages(safePage, totalPages),
    [safePage, totalPages],
  );

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    // Reset to page 1 whenever any filter changes
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const handlePageChange = (newPage: number) => {
    const clamped = Math.max(1, Math.min(newPage, totalPages));
    const next = new URLSearchParams(params);
    if (clamped <= 1) next.delete('page');
    else next.set('page', clamped.toString());
    setParams(next, { replace: true });

    // Smooth scroll to results top
    resultsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleDestinationChange = (newDest: string) => {
    const next = new URLSearchParams(params);
    if (newDest) {
      next.set('destinationId', newDest);
    } else {
      next.delete('destinationId');
      next.delete('commuteMotor');
      next.delete('commuteTransit');
      next.delete('maxCommuteMin');
      if (sortBy === 'waktu_ojek' || sortBy === 'waktu_transit') {
        next.delete('sortBy');
        next.delete('sortDir');
      }
    }
    next.delete('page');
    setParams(next, { replace: true });
  };

  const handleSortByChange = (newSortBy: SortKey) => {
    const next = new URLSearchParams(params);
    if (newSortBy === 'default') {
      next.delete('sortBy');
      next.delete('sortDir');
    } else {
      next.set('sortBy', newSortBy);
      const defaultDir: SortDir = newSortBy === 'rating' ? 'desc' : 'asc';
      next.set('sortDir', defaultDir);
    }
    next.delete('page');
    setParams(next, { replace: true });
  };

  const handleToggleSortDir = () => {
    if (sortBy === 'default') return;
    const next = new URLSearchParams(params);
    const nextDir: SortDir = sortDir === 'asc' ? 'desc' : 'asc';
    next.set('sortDir', nextDir);
    next.delete('page');
    setParams(next, { replace: true });
  };

  const toggleFacility = (facilityId: string) => {
    const set = new Set(selectedFacilities);
    if (set.has(facilityId)) {
      set.delete(facilityId);
    } else {
      set.add(facilityId);
    }
    const nextArr = Array.from(set);
    setParam('fasilitas', nextArr.join(','));
  };

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setParam('q', searchInput.trim());
  };

  const handleResetFilters = () => {
    setSearchInput('');
    navigate('/cari');
  };

  const destName = destinations.find((d) => d.id === destinationId)?.nama;
  const isFilterActive = Boolean(
    destinationId ||
      commuteMotor ||
      commuteTransit ||
      maxCommuteLegacy ||
      maxPriceParam ||
      tipe ||
      q ||
      selectedFacilities.length > 0 ||
      sortBy !== 'default' ||
      currentPage > 1,
  );

  return (
    <div className="page-container py-8">
      <h1 className="sr-only">Cari Kos</h1>

      {/* TOP: Dedicated Clean Search Bar */}
      <div className="mx-auto max-w-3xl">
        <form
          role="search"
          aria-label="Pencarian kata kunci kos"
          onSubmit={handleSearchSubmit}
          className="flex w-full items-center rounded-full border border-line/90 bg-surface p-1.5 shadow-float transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"
        >
          <div className="flex flex-1 items-center gap-2.5 pl-4 sm:pl-5">
            <Search size={19} className="shrink-0 text-muted" aria-hidden />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari nama kos, area, atau fasilitas... (mis. Kemang, Tebet, AC)"
              className="w-full bg-transparent text-sm text-ink placeholder:text-muted focus:outline-none"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setParam('q', '');
                }}
                className="mr-1 rounded-full p-1 text-muted transition hover:bg-bg hover:text-ink"
                aria-label="Hapus kata kunci pencarian"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <Button type="submit" className="shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold sm:px-7">
            Cari
          </Button>
        </form>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[290px_1fr]">
        {/* LEFT: Single Unified Filter Sidebar */}
        <Card className="h-fit space-y-5 p-5 shadow-card" aria-label="Filter Pencarian">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={18} className="text-primary" />
              <h2 className="text-base font-bold text-ink">Filter</h2>
            </div>
            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-primary transition hover:underline"
              >
                Reset
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* 1. Lokasi Tujuan */}
            <Select
              label="Lokasi Tujuan (Kampus/Kantor)"
              value={destinationId}
              onChange={(e) => handleDestinationChange(e.target.value)}
            >
              <option value="">Semua Lokasi / Destinasi</option>
              {destinations.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nama}
                </option>
              ))}
            </Select>

            {/* 2. Waktu Tempuh Maks (Terkunci jika Lokasi Tujuan belum dipilih) */}
            <div
              className={`space-y-2.5 rounded-2xl border p-3 transition ${
                destinationId
                  ? 'border-line/90 bg-bg/50'
                  : 'border-dashed border-line/70 bg-bg/30 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink">Waktu Tempuh Maksimal</span>
                {!destinationId && (
                  <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-semibold text-muted">
                    Terkunci
                  </span>
                )}
              </div>

              {!destinationId ? (
                <p className="text-[11px] leading-tight text-muted">
                  Pilih <strong>Lokasi Tujuan</strong> terlebih dahulu untuk menyaring berdasarkan waktu tempuh.
                </p>
              ) : (
                <p className="text-[11px] leading-tight text-muted">
                  Estimasi rute perjalanan ke <strong>{destName}</strong>
                </p>
              )}

              <div className="space-y-2">
                <Select
                  label="Motor / Ojek"
                  disabled={!destinationId}
                  value={commuteMotor?.toString() ?? ''}
                  onChange={(e) => setParam('commuteMotor', e.target.value)}
                >
                  <option value="">Semua waktu tempuh</option>
                  {COMMUTE_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      Hingga {m} menit
                    </option>
                  ))}
                </Select>

                <Select
                  label="Kereta / Transit"
                  disabled={!destinationId}
                  value={commuteTransit?.toString() ?? ''}
                  onChange={(e) => setParam('commuteTransit', e.target.value)}
                >
                  <option value="">Semua waktu tempuh</option>
                  {COMMUTE_OPTIONS.map((m) => (
                    <option key={m} value={m}>
                      Hingga {m} menit
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {/* 3. Harga Maksimal per Bulan (Satu Filter Saja) */}
            <Select
              label="Harga Maksimal / Bulan"
              value={maxPriceParam?.toString() ?? ''}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                next.delete('budget');
                if (e.target.value) next.set('maxPrice', e.target.value);
                else next.delete('maxPrice');
                next.delete('page');
                setParams(next, { replace: true });
              }}
            >
              <option value="">Tanpa batas harga</option>
              {MAX_PRICE_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  Hingga {formatRupiah(p)}/bln
                </option>
              ))}
            </Select>

            {/* 4. Tipe Kos */}
            <Select
              label="Tipe Kos"
              value={tipe}
              onChange={(e) => setParam('tipe', e.target.value)}
            >
              <option value="">Semua tipe</option>
              <option value="putra">Putra</option>
              <option value="putri">Putri</option>
              <option value="campur">Campur</option>
            </Select>

            {/* 5. Fasilitas Kos (Multi-select) */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ink">Fasilitas Kos</span>
                {selectedFacilities.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setParam('fasilitas', '')}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Hapus ({selectedFacilities.length})
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                {FACILITY_FILTER_OPTIONS.map((f) => {
                  const isChecked = selectedFacilities.includes(f.id);
                  return (
                    <label
                      key={f.id}
                      className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-1.5 text-xs transition select-none ${
                        isChecked
                          ? 'border-primary/60 bg-primary/10 font-semibold text-primary'
                          : 'border-line/70 bg-bg/40 text-ink/80 hover:border-line hover:bg-bg'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleFacility(f.id)}
                          className="h-3.5 w-3.5 rounded border-line text-primary focus:ring-primary/20"
                        />
                        <span>{f.label}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <Button variant="outline" className="w-full" onClick={handleResetFilters}>
            Atur Ulang Filter
          </Button>
        </Card>

        {/* RIGHT: Results Grid */}
        <section aria-live="polite">
          <div ref={resultsTopRef} />

          {/* Header Bar: Results summary + Sort Toolbar */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {isLoading ? (
                'Memuat kos...'
              ) : (
                <>
                  <span className="font-semibold text-ink">{results.length}</span> kos ditemukan
                  {q && (
                    <>
                      {' '}
                      untuk kata kunci <span className="font-medium text-ink">&ldquo;{q}&rdquo;</span>
                    </>
                  )}
                  {destName && (
                    <>
                      {' '}
                      · Tujuan: <span className="font-medium text-ink">{destName}</span>
                      {commuteMotor && (
                        <span className="text-xs text-muted"> (Motor &le; {commuteMotor} mnt)</span>
                      )}
                      {commuteTransit && (
                        <span className="text-xs text-muted"> (Transit &le; {commuteTransit} mnt)</span>
                      )}
                    </>
                  )}
                  {selectedFacilities.length > 0 && (
                    <span className="text-xs text-muted">
                      {' '}
                      · {selectedFacilities.length} fasilitas dipilih
                    </span>
                  )}
                </>
              )}
            </p>

            {/* Sort Toolbar */}
            {!isLoading && results.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted">Urutkan:</span>
                <select
                  value={sortBy}
                  onChange={(e) => handleSortByChange(e.target.value as SortKey)}
                  aria-label="Pilih kriteria urutan"
                  className="h-9 cursor-pointer rounded-xl border border-line/80 bg-surface px-3 py-1 text-xs font-semibold text-ink shadow-xs transition hover:border-primary focus:border-primary focus:outline-none"
                >
                  <option value="default">Rekomendasi</option>
                  <option value="harga">Harga Sewa</option>
                  <option value="waktu_ojek" disabled={!destinationId}>
                    Waktu Tempuh (Ojek) {!destinationId ? '(butuh destinasi)' : ''}
                  </option>
                  <option value="waktu_transit" disabled={!destinationId}>
                    Waktu Tempuh (Kereta / Transit) {!destinationId ? '(butuh destinasi)' : ''}
                  </option>
                  <option value="rating">Rating</option>
                  <option value="nama">Nama Kos</option>
                </select>

                {/* 1-click direction toggle button */}
                <button
                  type="button"
                  disabled={sortBy === 'default'}
                  onClick={handleToggleSortDir}
                  title={
                    sortBy === 'default'
                      ? 'Pilih kriteria urutkan terlebih dahulu'
                      : sortDir === 'asc'
                        ? 'Urutan menaik (klik untuk ubah ke menurun)'
                        : 'Urutan menurun (klik untuk ubah ke menaik)'
                  }
                  aria-label="Ganti arah urutan menaik atau menurun"
                  className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition active:scale-95 ${
                    sortBy === 'default'
                      ? 'cursor-not-allowed border-line/50 bg-bg/40 text-muted/40'
                      : 'cursor-pointer border-line/80 bg-surface text-ink hover:border-primary hover:bg-bg hover:text-primary'
                  }`}
                >
                  {sortDir === 'asc' ? (
                    <ArrowUpNarrowWide size={15} className="shrink-0 text-primary" />
                  ) : (
                    <ArrowDownWideNarrow size={15} className="shrink-0 text-primary" />
                  )}
                  <span>{getSortDirLabel(sortBy, sortDir)}</span>
                </button>
              </div>
            )}
          </div>

          {isError ? (
            <EmptyState
              title="Gagal memuat kos"
              description="Terjadi kesalahan saat mengambil data."
              action={<Button onClick={() => void refetch()}>Coba Lagi</Button>}
            />
          ) : isLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <KosCardSkeleton key={i} />
              ))}
            </div>
          ) : results.length === 0 ? (
            <EmptyState
              icon={<SearchX size={26} />}
              title="Kos tidak ditemukan"
              description="Coba ubah kata kunci pencarian, sesuaikan filter, atau atur ulang filter."
              action={<Button onClick={handleResetFilters}>Atur Ulang Filter</Button>}
            />
          ) : (
            <>
              {/* Cards Grid: Render only the current page (12 items) */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visibleResults.map((k) => (
                  <KosCard key={k.id} kos={k} commute={k.commute} destinationId={destinationId || undefined} />
                ))}
              </div>

              {/* Numbered Pagination Navigation */}
              {totalPages > 1 && (
                <nav
                  aria-label="Navigasi halaman kos"
                  className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-line/80 pt-6 sm:flex-row"
                >
                  <p className="text-xs text-muted">
                    Menampilkan{' '}
                    <span className="font-semibold text-ink">
                      {(safePage - 1) * PAGE_SIZE + 1} -{' '}
                      {Math.min(safePage * PAGE_SIZE, results.length)}
                    </span>{' '}
                    dari <span className="font-semibold text-ink">{results.length}</span> kos (Halaman{' '}
                    <span className="font-semibold text-ink">{safePage}</span> dari{' '}
                    <span className="font-semibold text-ink">{totalPages}</span>)
                  </p>

                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage <= 1}
                      onClick={() => handlePageChange(safePage - 1)}
                      className="h-8 gap-1 rounded-xl px-3 text-xs"
                      aria-label="Halaman sebelumnya"
                    >
                      <ChevronLeft size={14} />
                      <span className="hidden sm:inline">Sebelumnya</span>
                    </Button>

                    <div className="flex items-center gap-1">
                      {paginationPages.map((p, idx) =>
                        p === '...' ? (
                          <span
                            key={`ellipsis-${idx}`}
                            className="flex h-8 w-6 select-none items-center justify-center text-xs text-muted"
                          >
                            ...
                          </span>
                        ) : (
                          <button
                            key={p}
                            type="button"
                            onClick={() => handlePageChange(p)}
                            className={`h-8 min-w-[32px] rounded-xl px-2 text-xs font-semibold transition ${
                              p === safePage
                                ? 'bg-primary text-white shadow-xs'
                                : 'border border-line/80 bg-surface text-ink hover:border-primary hover:text-primary'
                            }`}
                            aria-current={p === safePage ? 'page' : undefined}
                            aria-label={`Ke halaman ${p}`}
                          >
                            {p}
                          </button>
                        ),
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage >= totalPages}
                      onClick={() => handlePageChange(safePage + 1)}
                      className="h-8 gap-1 rounded-xl px-3 text-xs"
                      aria-label="Halaman berikutnya"
                    >
                      <span className="hidden sm:inline">Berikutnya</span>
                      <ChevronRight size={14} />
                    </Button>
                  </div>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
