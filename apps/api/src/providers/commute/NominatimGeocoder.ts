import {
  JAKARTA_LOCATION_HUBS,
  calculateDistanceKm,
  resolveLocationQuery,
  type LocationHub,
  type ResolvedLocation,
} from '@kosmatch/shared';

interface NominatimAddress {
  suburb?: string;
  city_district?: string;
  village?: string;
  municipality?: string;
  city?: string;
  county?: string;
  state?: string;
  road?: string;
}

interface NominatimItem {
  place_id?: number;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  address?: NominatimAddress;
}

const NON_LOCATION_ONLY_TERMS = new Set([
  'ac',
  'wifi',
  'wi-fi',
  'kasur',
  'lemari',
  'meja',
  'dapur',
  'parkir',
  'laundry',
  'putra',
  'putri',
  'campur',
  'murah',
  'mahal',
  'eksekutif',
  'kamar mandi dalam',
  'km dalam',
]);

export interface NominatimGeocoderOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  enableNetwork?: boolean;
}

/**
 * Hybrid Location & Corridor Resolver powered by:
 * 1. Built-in Greater Jakarta Gazetteer (`resolveLocationQuery`) for 0ms deterministic resolution
 * 2. OpenStreetMap Nominatim Open-Source Geocoder (`nominatim.openstreetmap.org`) fallback
 *    for dynamic streets, buildings, or neighborhoods in Jabodetabek.
 */
export class NominatimGeocoder {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly enableNetwork: boolean;
  private readonly cache = new Map<string, ResolvedLocation | null>();

  constructor(options: NominatimGeocoderOptions = {}) {
    this.baseUrl = (
      options.baseUrl ??
      process.env.NOMINATIM_BASE_URL ??
      'https://nominatim.openstreetmap.org'
    ).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 2000;
    this.fetchFn = options.fetchFn ?? fetch;
    this.enableNetwork =
      options.enableNetwork ??
      (process.env.NODE_ENV !== 'test' && process.env.COMMUTE_PROVIDER !== 'mock');
  }

  async resolve(rawQuery: string): Promise<ResolvedLocation | null> {
    const clean = rawQuery.trim();
    if (clean.length < 3) return null;

    // 1. Check built-in Greater Jakarta Gazetteer first (instant 0ms)
    const localMatch = resolveLocationQuery(clean);
    if (localMatch) {
      return localMatch;
    }

    const key = clean.toLowerCase();
    if (NON_LOCATION_ONLY_TERMS.has(key)) {
      return null;
    }

    if (this.cache.has(key)) {
      return this.cache.get(key) ?? null;
    }

    if (!this.enableNetwork) {
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const searchQ = /jakarta|depok|tangerang|bekasi|bogor/i.test(clean)
        ? clean
        : `${clean}, Jakarta`;
      const url = `${this.baseUrl}/search?format=json&addressdetails=1&limit=1&countrycodes=id&q=${encodeURIComponent(searchQ)}`;
      const res = await this.fetchFn(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'KosMatch-Jakarta/1.0 (OpenStreetMap Nominatim Geocoder)',
        },
        signal: controller.signal,
      });
      if (!res.ok) {
        this.cache.set(key, null);
        return null;
      }

      const items = (await res.json()) as NominatimItem[];
      const first = items[0];
      const lat = first?.lat ? Number.parseFloat(first.lat) : NaN;
      const lon = first?.lon ? Number.parseFloat(first.lon) : NaN;

      // Validate coordinates fall within Greater Jakarta (Jabodetabek) bounding box
      if (
        !first ||
        Number.isNaN(lat) ||
        Number.isNaN(lon) ||
        lat < -6.85 ||
        lat > -5.9 ||
        lon < 106.35 ||
        lon > 107.4
      ) {
        this.cache.set(key, null);
        return null;
      }

      // Find closest local hub to inherit surrounding district context
      const closestHub = JAKARTA_LOCATION_HUBS.reduce((best, cur) => {
        const dBest = calculateDistanceKm(lat, lon, best.latitude, best.longitude);
        const dCur = calculateDistanceKm(lat, lon, cur.latitude, cur.longitude);
        return dCur < dBest ? cur : best;
      });

      const addr = first.address ?? {};
      const nearbySet = new Set<string>();
      for (const candidate of [
        addr.suburb,
        addr.city_district,
        addr.village,
        addr.municipality,
        addr.city,
        ...closestHub.nearbyAreas.slice(0, 5),
      ]) {
        if (candidate && candidate.trim().length > 0) {
          nearbySet.add(candidate.trim());
        }
      }

      const displayName = first.name?.trim() || clean;
      const region = addr.city || addr.county || closestHub.region;
      const nearbyAreas = Array.from(nearbySet);
      const dynamicHub: LocationHub = {
        id: `osm-${key.replace(/[^a-z0-9]+/g, '-')}`,
        name: displayName,
        region,
        category: 'kawasan',
        latitude: lat,
        longitude: lon,
        radiusKm: 4.0,
        aliases: [key],
        nearbyAreas,
      };

      const resolved: ResolvedLocation = {
        hub: dynamicHub,
        matchedAlias: key,
        displayName,
        region,
        latitude: lat,
        longitude: lon,
        radiusKm: 4.0,
        nearbyAreas,
        searchTerms: [key, ...nearbyAreas.map((a) => a.toLowerCase())],
        areaKeywords: [displayName, ...nearbyAreas],
        virtualDestination: {
          id: dynamicHub.id,
          nama: displayName,
          kategori: 'kantor',
          latitude: lat,
          longitude: lon,
          aliases: [key],
        },
      };

      this.cache.set(key, resolved);
      return resolved;
    } catch {
      this.cache.set(key, null);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export const defaultGeocoder = new NominatimGeocoder();
