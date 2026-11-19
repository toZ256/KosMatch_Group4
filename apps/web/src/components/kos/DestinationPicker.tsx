import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Compass, Loader2, MapPin, Search, X } from 'lucide-react';
import { JAKARTA_LOCATION_HUBS, type PlaceSuggestion } from '@kosmatch/shared';
import { useDestinations, usePlaceSearch } from '../../api/hooks';
import { cn } from '../../lib/cn';

export interface SelectedDestination {
  label: string;
  destinationId?: string;
  latitude?: number;
  longitude?: number;
}

interface DestinationPickerProps {
  id?: string;
  label?: string;
  placeholder?: string;
  value: SelectedDestination | null;
  onSelect: (dest: SelectedDestination | null) => void;
  /** Optional hook so parent forms can capture raw typed text when user submits without picking a dropdown item. */
  onTextChange?: (rawText: string) => void;
  variant?: 'omnibox' | 'field';
  className?: string;
}

const CATEGORY_BADGE: Record<PlaceSuggestion['category'], string> = {
  destinasi: 'Tujuan Utama',
  kawasan: 'Kawasan',
  tempat: 'Gedung / Lokasi',
};

export function DestinationPicker({
  id,
  label,
  placeholder = 'Ketik gedung, mall, kampus, atau area (mis. Senayan City, GBK)',
  value,
  onSelect,
  onTextChange,
  variant = 'field',
  className,
}: DestinationPickerProps) {
  const { data: destinations = [] } = useDestinations();
  const [inputText, setInputText] = useState(value?.label ?? '');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputText(value?.label ?? '');
  }, [value?.label]);

  useEffect(() => {
    const trimmed = inputText.trim();
    const t = setTimeout(() => setDebouncedQuery(trimmed), 280);
    return () => clearTimeout(t);
  }, [inputText]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const { data: remotePlaces = [], isFetching } = usePlaceSearch(
    open && debouncedQuery.length >= 2 ? debouncedQuery : '',
  );

  // Instant local suggestions (0ms) merged with live OpenStreetMap places
  const suggestions = useMemo<PlaceSuggestion[]>(() => {
    const q = inputText.trim().toLowerCase();
    const items: PlaceSuggestion[] = [];
    const seen = new Set<string>();

    const add = (item: PlaceSuggestion) => {
      const key = item.label.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      items.push(item);
    };

    if (!q) {
      // Quick popular defaults when focused while empty
      for (const d of destinations.slice(0, 4)) {
        add({
          id: `dest-${d.id}`,
          label: d.nama,
          subtitle:
            d.kategori === 'kampus'
              ? 'Kampus Utama'
              : d.kategori === 'stasiun'
                ? 'Stasiun / Transit'
                : 'Kawasan Perkantoran',
          category: 'destinasi',
          latitude: d.latitude,
          longitude: d.longitude,
          destinationId: d.id,
        });
      }
      for (const hub of JAKARTA_LOCATION_HUBS.slice(0, 4)) {
        add({
          id: `hub-${hub.id}`,
          label: hub.name,
          subtitle: `${hub.region} · Sekitar ${hub.nearbyAreas.slice(0, 2).join(', ')}`,
          category: 'kawasan',
          latitude: hub.latitude,
          longitude: hub.longitude,
          destinationId: hub.id,
        });
      }
      return items;
    }

    for (const d of destinations) {
      if (
        d.nama.toLowerCase().includes(q) ||
        d.aliases.some((a) => a.toLowerCase().includes(q))
      ) {
        add({
          id: `dest-${d.id}`,
          label: d.nama,
          subtitle:
            d.kategori === 'kampus'
              ? 'Kampus Utama'
              : d.kategori === 'stasiun'
                ? 'Stasiun / Transit'
                : 'Kawasan Perkantoran',
          category: 'destinasi',
          latitude: d.latitude,
          longitude: d.longitude,
          destinationId: d.id,
        });
      }
    }

    for (const hub of JAKARTA_LOCATION_HUBS) {
      if (
        hub.name.toLowerCase().includes(q) ||
        hub.region.toLowerCase().includes(q) ||
        hub.aliases.some((a) => a.toLowerCase().includes(q)) ||
        hub.nearbyAreas.some((a) => a.toLowerCase().includes(q))
      ) {
        add({
          id: `hub-${hub.id}`,
          label: hub.name,
          subtitle: `${hub.region} · Sekitar ${hub.nearbyAreas.slice(0, 2).join(', ')}`,
          category: 'kawasan',
          latitude: hub.latitude,
          longitude: hub.longitude,
          destinationId: hub.id,
        });
      }
    }

    for (const place of remotePlaces) {
      add(place);
    }

    return items.slice(0, 8);
  }, [inputText, destinations, remotePlaces]);

  const handlePick = (item: PlaceSuggestion) => {
    setInputText(item.label);
    setOpen(false);
    onTextChange?.(item.label);
    onSelect({
      label: item.label,
      destinationId: item.destinationId,
      latitude: item.latitude,
      longitude: item.longitude,
    });
  };

  const handleClear = () => {
    setInputText('');
    setDebouncedQuery('');
    onTextChange?.('');
    onSelect(null);
  };

  const isOmnibox = variant === 'omnibox';

  return (
    <div ref={containerRef} className={cn('relative w-full', open && 'z-40', className)}>
      {label && (
        <label
          htmlFor={id}
          className={cn(
            'block',
            isOmnibox ? 'text-[11px] font-bold text-ink' : 'mb-1.5 text-sm font-medium text-ink',
          )}
        >
          {label}
        </label>
      )}

      <div
        className={cn(
          'relative flex items-center',
          !isOmnibox &&
            'rounded-2xl border border-line/80 bg-bg/50 px-3.5 transition hover:border-accent/50 focus-within:border-accent focus-within:bg-surface focus-within:ring-4 focus-within:ring-accent/15',
        )}
      >
        {!isOmnibox && <Search size={15} className="mr-2 shrink-0 text-muted" aria-hidden />}
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          value={inputText}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            const nextVal = e.target.value;
            setInputText(nextVal);
            setOpen(true);
            onTextChange?.(nextVal);
            if (!nextVal.trim() && value) {
              onSelect(null);
            }
          }}
          className={cn(
            'w-full bg-transparent text-sm text-ink placeholder:text-muted/75 focus:outline-none',
            isOmnibox ? 'pr-6' : 'py-3 pr-7',
          )}
        />
        {isFetching && open ? (
          <Loader2
            size={14}
            className={cn(
              'animate-spin text-accent',
              isOmnibox ? 'absolute right-0' : 'absolute right-3',
            )}
            aria-label="Mencari lokasi"
          />
        ) : inputText ? (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Hapus lokasi tujuan"
            className={cn(
              'rounded-full p-0.5 text-muted transition hover:bg-bg hover:text-ink',
              isOmnibox ? 'absolute right-0' : 'absolute right-2.5',
            )}
          >
            <X size={14} />
          </button>
        ) : null}
      </div>

      {open && (
        <div
          data-testid="destination-picker-dropdown"
          className={cn(
            'absolute left-0 top-full z-50 mt-2.5 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-float',
            isOmnibox ? 'w-[min(360px,calc(100vw-2.5rem))] sm:-left-2 sm:mt-3.5' : 'right-0',
          )}
        >
          <div className="flex items-center justify-between px-2.5 py-1.5 text-[10px] font-semibold text-muted">
            <span>
              {inputText.trim().length < 2
                ? 'Tujuan & Kawasan Populer'
                : 'Hasil Pencarian Gedung, Mall, Kampus & Area'}
            </span>
            {isFetching && (
              <span className="inline-flex items-center gap-1 text-accent">
                <Loader2 size={10} className="animate-spin" /> Mencari...
              </span>
            )}
          </div>

          {suggestions.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted">
              {isFetching
                ? 'Mencari titik lokasi di Jakarta & sekitarnya...'
                : 'Lokasi belum ditemukan. Coba ketik nama gedung, mall, atau jalan di Jabodetabek.'}
            </div>
          ) : (
            <ul className="max-h-64 space-y-0.5 overflow-y-auto" role="listbox">
              {suggestions.map((item) => (
                <li key={item.id} role="option" aria-selected={value?.label === item.label}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handlePick(item);
                    }}
                    className="flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition hover:bg-bg"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-bg text-primary">
                      {item.category === 'tempat' ? (
                        <Building2 size={13} className="text-primary" />
                      ) : item.category === 'kawasan' ? (
                        <Compass size={13} className="text-accent" />
                      ) : (
                        <MapPin size={13} className="text-primary" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-bold text-ink">{item.label}</span>
                        <span className="shrink-0 rounded-md bg-bg px-1.5 py-0.5 text-[9px] font-semibold text-muted">
                          {CATEGORY_BADGE[item.category]}
                        </span>
                      </div>
                      <p className="truncate text-[11px] text-muted">{item.subtitle}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
