import {
  JAKARTA_LOCATION_HUBS,
  calculateDistanceKm,
  resolveLocationQuery,
  type LocationHub,
  type PlaceSuggestion,
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

interface PhotonFeature {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    osm_id?: number;
    name?: string;
    street?: string;
    district?: string;
    locality?: string;
    city?: string;
    county?: string;
    state?: string;
    countrycode?: string;
  };
}

interface PhotonPayload {
  features?: PhotonFeature[];
}

const JABODETABEK_BOUNDS = {
  minLat: -6.85,
  maxLat: -5.9,
  minLon: 106.35,
  maxLon: 107.4,
};

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

function isWithinJabodetabek(lat: number, lon: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= JABODETABEK_BOUNDS.minLat &&
    lat <= JABODETABEK_BOUNDS.maxLat &&
    lon >= JABODETABEK_BOUNDS.minLon &&
    lon <= JABODETABEK_BOUNDS.maxLon
  );
}

export interface NominatimGeocoderOptions {
  baseUrl?: string;
  photonBaseUrl?: string;
  timeoutMs?: number;
  fetchFn?: typeof fetch;
  enableNetwork?: boolean;
}

/**
 * Hybrid Location, Building & Corridor Resolver powered by:
 * 1. Built-in Greater Jakarta Gazetteer (`resolveLocationQuery`) for 0ms deterministic resolution
 * 2. OpenStreetMap Photon (`photon.komoot.io`) + Nominatim (`nominatim.openstreetmap.org`)
 *    open-source geocoders for arbitrary buildings, malls, offices, campuses, and streets in Jabodetabek.
 */
export class NominatimGeocoder {
  private readonly baseUrl: string;
  private readonly photonBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly enableNetwork: boolean;
  private readonly cache = new Map<string, ResolvedLocation | null>();
  private readonly placeSearchCache = new Map<string, PlaceSuggestion[]>();

  constructor(options: NominatimGeocoderOptions = {}) {
    this.baseUrl = (
      options.baseUrl ??
      process.env.NOMINATIM_BASE_URL ??
      'https://nominatim.openstreetmap.org'
    ).replace(/\/+$/, '');
    this.photonBaseUrl = (
      options.photonBaseUrl ??
      process.env.PHOTON_BASE_URL ??
      'https://photon.komoot.io'
    ).replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 2500;
    this.fetchFn = options.fetchFn ?? fetch;
    this.enableNetwork =
      options.enableNetwork ??
      (process.env.NODE_ENV !== 'test' && process.env.COMMUTE_PROVIDER !== 'mock');
  }

  private async fetchPhotonPlaces(clean: string, limit: number): Promise<PlaceSuggestion[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const bbox = `${JABODETABEK_BOUNDS.minLon},${JABODETABEK_BOUNDS.minLat},${JABODETABEK_BOUNDS.maxLon},${JABODETABEK_BOUNDS.maxLat}`;
      const url = `${this.photonBaseUrl}/api/?q=${encodeURIComponent(clean)}&lat=-6.2088&lon=106.8456&bbox=${bbox}&limit=${limit}`;
      const res = await this.fetchFn(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'KosMatch-Jakarta/1.0 (OpenStreetMap Place Search)',
        },
        signal: controller.signal,
      });
      if (!res.ok) return [];
      const payload = (await res.json()) as PhotonPayload;
      const features = Array.isArray(payload.features) ? payload.features : [];
      const results: PlaceSuggestion[] = [];
      const seen = new Set<string>();

      for (const f of features) {
        const coords = f.geometry?.coordinates;
        const props = f.properties;
        if (!coords || coords.length < 2 || !props) continue;
        const lon = Number(coords[0]);
        const lat = Number(coords[1]);
        if (!isWithinJabodetabek(lat, lon)) continue;

        const label = (props.name || props.street || '').trim();
        if (!label) continue;
        const subtitleParts = [props.street !== label ? props.street : undefined, props.district || props.locality, props.city || props.county || props.state]
          .map((s) => s?.trim())
          .filter((s): s is string => Boolean(s));
        const subtitle = Array.from(new Set(subtitleParts)).join(', ') || 'Jabodetabek';
        const dedupeKey = `${label.toLowerCase()}|${lat.toFixed(3)},${lon.toFixed(3)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        results.push({
          id: `osm-place-${props.osm_id ?? results.length}-${lat.toFixed(4)}-${lon.toFixed(4)}`,
          label,
          subtitle,
          category: 'tempat',
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lon.toFixed(6)),
        });
      }

      return results;
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  private async fetchNominatimPlaces(clean: string, limit: number): Promise<PlaceSuggestion[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const searchQ = /jakarta|depok|tangerang|bekasi|bogor/i.test(clean)
        ? clean
        : `${clean}, Jakarta`;
      const viewbox = `${JABODETABEK_BOUNDS.minLon},${JABODETABEK_BOUNDS.maxLat},${JABODETABEK_BOUNDS.maxLon},${JABODETABEK_BOUNDS.minLat}`;
      const url = `${this.baseUrl}/search?format=json&addressdetails=1&limit=${limit}&countrycodes=id&viewbox=${viewbox}&bounded=1&q=${encodeURIComponent(searchQ)}`;
      const res = await this.fetchFn(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'KosMatch-Jakarta/1.0 (OpenStreetMap Nominatim Geocoder)',
        },
        signal: controller.signal,
      });
      if (!res.ok) return [];

      const items = (await res.json()) as NominatimItem[];
      const results: PlaceSuggestion[] = [];
      const seen = new Set<string>();

      for (const item of items) {
        const lat = item.lat ? Number.parseFloat(item.lat) : NaN;
        const lon = item.lon ? Number.parseFloat(item.lon) : NaN;
        if (!isWithinJabodetabek(lat, lon)) continue;

        const addr = item.address ?? {};
        const label =
          item.name?.trim() ||
          item.display_name?.split(',')[0]?.trim() ||
          clean;
        const subtitleParts = [
          addr.road !== label ? addr.road : undefined,
          addr.suburb || addr.village || addr.city_district,
          addr.city || addr.county || addr.municipality,
        ]
          .map((s) => s?.trim())
          .filter((s): s is string => Boolean(s));
        const subtitle = Array.from(new Set(subtitleParts)).join(', ') || 'Jabodetabek';
        const dedupeKey = `${label.toLowerCase()}|${lat.toFixed(3)},${lon.toFixed(3)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        results.push({
          id: `osm-nom-${item.place_id ?? results.length}-${lat.toFixed(4)}-${lon.toFixed(4)}`,
          label,
          subtitle,
          category: 'tempat',
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lon.toFixed(6)),
        });
      }

      return results;
    } catch {
      return [];
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Searches arbitrary buildings, malls, stadiums, offices, campuses, or streets in Greater Jakarta
   * using OpenStreetMap Photon with Nominatim fallback. Cached in-memory.
   */
  async searchPlaces(rawQuery: string, limit = 6): Promise<PlaceSuggestion[]> {
    const clean = rawQuery.trim();
    if (clean.length < 2) return [];
    const key = clean.toLowerCase();
    if (NON_LOCATION_ONLY_TERMS.has(key)) return [];

    const cached = this.placeSearchCache.get(key);
    if (cached) return cached.slice(0, limit);
    if (!this.enableNetwork) return [];

    let results = await this.fetchPhotonPlaces(clean, limit);
    if (results.length === 0) {
      results = await this.fetchNominatimPlaces(clean, limit);
    }

    if (this.placeSearchCache.size >= 200) {
      const oldest = this.placeSearchCache.keys().next().value;
      if (oldest) this.placeSearchCache.delete(oldest);
    }
    this.placeSearchCache.set(key, results);
    return results.slice(0, limit);
  }

  private buildResolvedFromCoords(
    key: string,
    displayName: string,
    lat: number,
    lon: number,
    extraAreas: Array<string | undefined>,
    explicitRegion?: string,
  ): ResolvedLocation {
    const closestHub = JAKARTA_LOCATION_HUBS.reduce((best, cur) => {
      const dBest = calculateDistanceKm(lat, lon, best.latitude, best.longitude);
      const dCur = calculateDistanceKm(lat, lon, cur.latitude, cur.longitude);
      return dCur < dBest ? cur : best;
    });

    const nearbySet = new Set<string>();
    for (const candidate of [...extraAreas, ...closestHub.nearbyAreas.slice(0, 5)]) {
      if (candidate && candidate.trim().length > 0) {
        nearbySet.add(candidate.trim());
      }
    }

    const region = explicitRegion?.trim() || closestHub.region;
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

    return {
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

    // 2. Try Nominatim directly (preserves existing mockFetch test compatibility & detailed address)
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
      if (res.ok) {
        const items = (await res.json()) as NominatimItem[];
        const first = items[0];
        const lat = first?.lat ? Number.parseFloat(first.lat) : NaN;
        const lon = first?.lon ? Number.parseFloat(first.lon) : NaN;

        if (first && isWithinJabodetabek(lat, lon)) {
          const addr = first.address ?? {};
          const displayName = first.name?.trim() || clean;
          const resolved = this.buildResolvedFromCoords(
            key,
            displayName,
            lat,
            lon,
            [addr.suburb, addr.city_district, addr.village, addr.municipality, addr.city],
            addr.city || addr.county,
          );
          this.cache.set(key, resolved);
          return resolved;
        }
      }
    } catch {
      // Fall through to Photon
    } finally {
      clearTimeout(timer);
    }

    // 3. Fallback to Photon (great for buildings, malls, stadiums like "GBK" / "Senayan City")
    const photonMatches = await this.fetchPhotonPlaces(clean, 1);
    const firstPhoton = photonMatches[0];
    if (firstPhoton) {
      const subtitleParts = firstPhoton.subtitle.split(',').map((s) => s.trim());
      const resolved = this.buildResolvedFromCoords(
        key,
        firstPhoton.label,
        firstPhoton.latitude,
        firstPhoton.longitude,
        subtitleParts,
        subtitleParts[subtitleParts.length - 1],
      );
      this.cache.set(key, resolved);
      return resolved;
    }

    this.cache.set(key, null);
    return null;
  }
}

export const defaultGeocoder = new NominatimGeocoder();
