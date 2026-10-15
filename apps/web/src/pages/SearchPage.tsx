import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SearchX } from 'lucide-react';
import { useDestinations, useKosList } from '../api/hooks';
import { KosCard, KosCardSkeleton } from '../components/kos/KosCard';
import { SearchBar } from '../components/kos/SearchBar';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Input, Select } from '../components/ui/Input';
import { fastestCommute, formatRupiah } from '../lib/format';
import { BUDGET_RANGES, MAX_PRICE_OPTIONS } from '../lib/search';

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: destinations = [] } = useDestinations();

  const destinationId = params.get('destinationId') ?? '';
  const maxCommuteMin = Number(params.get('maxCommuteMin')) || undefined;
  const budget = BUDGET_RANGES.find((b) => b.value === params.get('budget'));
  const maxPriceParam = Number(params.get('maxPrice')) || undefined;
  const tipe = params.get('tipe') ?? '';
  const q = params.get('q') ?? '';

  const maxPrice = [budget?.max, maxPriceParam].filter((n): n is number => n !== undefined).sort((a, b) => a - b)[0];

  const { data, isLoading, isError, refetch } = useKosList({
    destinationId: destinationId || undefined,
    maxPrice,
    tipe: tipe || undefined,
    q: q || undefined,
  });

  const results = useMemo(
    () =>
      (data ?? []).filter((k) => {
        if (budget?.min !== undefined && k.hargaSewa < budget.min) return false;
        if (destinationId && maxCommuteMin) {
          const best = fastestCommute(k.commute);
          if (!best || best.durationMin > maxCommuteMin) return false;
        }
        return true;
      }),
    [data, budget, destinationId, maxCommuteMin],
  );

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const destName = destinations.find((d) => d.id === destinationId)?.nama;

  return (
    <div className="page-container py-8">
      <h1 className="sr-only">Cari Kos</h1>
      <SearchBar
        key={`${destinationId}|${maxCommuteMin ?? ''}|${budget?.value ?? ''}`}
        initial={{ destinationId, maxCommuteMin: maxCommuteMin?.toString() ?? '', budget: budget?.value ?? '' }}
        onSubmit={(values) => {
          const next = new URLSearchParams(params);
          for (const key of ['destinationId', 'maxCommuteMin', 'budget'] as const) {
            if (values[key]) next.set(key, values[key]);
            else next.delete(key);
          }
          navigate(`/cari${next.toString() ? `?${next.toString()}` : ''}`);
        }}
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[260px_1fr]">
        <Card className="h-fit space-y-4 p-5" aria-label="Filter">
          <h2 className="text-base font-semibold">Filter</h2>
          <Input
            label="Nama atau area"
            placeholder="mis. Kemang"
            defaultValue={q}
            onKeyDown={(e) => e.key === 'Enter' && setParam('q', e.currentTarget.value.trim())}
            onBlur={(e) => setParam('q', e.currentTarget.value.trim())}
          />
          <Select label="Harga maks" value={maxPriceParam?.toString() ?? ''} onChange={(e) => setParam('maxPrice', e.target.value)}>
            <option value="">Semua harga</option>
            {MAX_PRICE_OPTIONS.map((p) => (
              <option key={p} value={p}>
                Hingga {formatRupiah(p)}
              </option>
            ))}
          </Select>
          <Select label="Tipe kos" value={tipe} onChange={(e) => setParam('tipe', e.target.value)}>
            <option value="">Semua tipe</option>
            <option value="putra">Putra</option>
            <option value="putri">Putri</option>
            <option value="campur">Campur</option>
          </Select>
          <Button variant="outline" className="w-full" onClick={() => navigate('/cari')}>
            Atur Ulang
          </Button>
        </Card>

        <section aria-live="polite">
          <p className="mb-4 text-sm text-muted">
            {isLoading ? 'Memuat kos...' : `${results.length} kos ditemukan`}
            {destName && (
              <>
                {' '}
                · Estimasi perjalanan ke <span className="font-medium text-ink">{destName}</span>
              </>
            )}
          </p>
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
              description="Coba ubah filter, naikkan budget, atau perpanjang waktu tempuh."
              action={<Button onClick={() => navigate('/cari')}>Atur Ulang Filter</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((k) => (
                <KosCard key={k.id} kos={k} commute={k.commute} destinationId={destinationId || undefined} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
