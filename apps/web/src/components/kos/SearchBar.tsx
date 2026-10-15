import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import { useDestinations } from '../../api/hooks';
import { BUDGET_RANGES, COMMUTE_OPTIONS, type SearchValues } from '../../lib/search';

const selectClass =
  'w-full cursor-pointer appearance-none bg-transparent text-sm text-ink focus:outline-none truncate';

interface SearchBarProps {
  initial?: Partial<SearchValues>;
  onSubmit: (values: SearchValues) => void;
}

export function SearchBar({ initial, onSubmit }: SearchBarProps) {
  const { data: destinations = [] } = useDestinations();
  const [values, setValues] = useState<SearchValues>({
    destinationId: initial?.destinationId ?? '',
    maxCommuteMin: initial?.maxCommuteMin ?? '',
    budget: initial?.budget ?? '',
  });
  const set = (key: keyof SearchValues) => (e: React.ChangeEvent<HTMLSelectElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form
      role="search"
      aria-label="Pencarian kos"
      onSubmit={submit}
      className="mx-auto flex w-full max-w-[720px] flex-col gap-1 rounded-3xl bg-surface p-3 shadow-card sm:flex-row sm:items-center sm:gap-0 sm:rounded-full sm:py-2 sm:pl-3 sm:pr-2"
    >
      <div className="min-w-0 flex-1 px-4 py-1.5 text-left">
        <label htmlFor="search-destination" className="block text-[11px] font-semibold text-ink">
          Lokasi Tujuan
        </label>
        <select id="search-destination" value={values.destinationId} onChange={set('destinationId')} className={selectClass}>
          <option value="">Kampus / Kantor / Stasiun</option>
          {destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nama}
            </option>
          ))}
        </select>
      </div>
      <div className="mx-4 h-px bg-line sm:mx-0 sm:h-8 sm:w-px" aria-hidden />
      <div className="min-w-0 flex-1 px-4 py-1.5 text-left">
        <label htmlFor="search-commute" className="block text-[11px] font-semibold text-ink">
          Waktu Tempuh Maks
        </label>
        <select id="search-commute" value={values.maxCommuteMin} onChange={set('maxCommuteMin')} className={selectClass}>
          <option value="">Pilih waktu</option>
          {COMMUTE_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m} menit
            </option>
          ))}
        </select>
      </div>
      <div className="mx-4 h-px bg-line sm:mx-0 sm:h-8 sm:w-px" aria-hidden />
      <div className="min-w-0 flex-1 px-4 py-1.5 text-left">
        <label htmlFor="search-budget" className="block text-[11px] font-semibold text-ink">
          Biaya Sewa
        </label>
        <select id="search-budget" value={values.budget} onChange={set('budget')} className={selectClass}>
          <option value="">Pilih budget</option>
          {BUDGET_RANGES.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        id="search-submit"
        aria-label="Cari kos"
        className="mt-1 flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-white transition hover:brightness-95 sm:mt-0 sm:h-11 sm:w-11"
      >
        <Search size={18} />
        <span className="sm:hidden">Cari</span>
      </button>
    </form>
  );
}
