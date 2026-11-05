import type { CommuteEstimate, Destination, Kos, TransportMode } from '@kosmatch/shared';
import type { CommuteProvider } from './CommuteProvider';
import { MockCommuteProvider, haversineKm } from './MockCommuteProvider';

const round1 = (n: number) => Math.round(n * 10) / 10;
const roundTo500 = (n: number) => Math.round(n / 500) * 500;
const ceilMinutes = (n: number) => Math.ceil(Number(n.toFixed(6)));

export interface OsrmOptions {
  baseUrl?: string;
  timeoutMs?: number;
  maxConcurrent?: number;
  fetchFn?: typeof fetch;
}

interface OsrmRoutePayload {
  code?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
  }>;
}

interface CachedRoute {
  distanceKm: number;
  drivingDurationMin: number;
}

/**
 * Commute estimator powered by OSRM (OpenStreetMap street network routing in Jakarta).
 * Caches street distances in-memory and automatically falls back to MockCommuteProvider
 * when offline or rate-limited.
 */
export class OsrmCommuteProvider implements CommuteProvider {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxConcurrent: number;
  private readonly fetchFn: typeof fetch;
  private readonly fallback = new MockCommuteProvider();
  private readonly cache = new Map<string, CachedRoute>();
  private readonly inflight = new Map<string, Promise<CachedRoute | null>>();
  private activeRequests = 0;

  constructor(options: OsrmOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.OSRM_BASE_URL ?? 'https://router.project-osrm.org').replace(
      /\/+$/,
      '',
    );
    this.timeoutMs = options.timeoutMs ?? 2000;
    this.maxConcurrent = options.maxConcurrent ?? 6;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private cacheKey(kos: Kos, dest: Destination): string {
    return `${kos.latitude.toFixed(4)},${kos.longitude.toFixed(4)}->${dest.latitude.toFixed(4)},${dest.longitude.toFixed(4)}`;
  }

  private async fetchRoute(kos: Kos, dest: Destination): Promise<CachedRoute | null> {
    const key = this.cacheKey(kos, dest);
    const hit = this.cache.get(key);
    if (hit) return hit;

    const pending = this.inflight.get(key);
    if (pending) return pending;

    // Avoid flooding the public OSRM server on bulk queries or invalid coordinates
    if (this.activeRequests >= this.maxConcurrent) return null;
    if (kos.latitude === 0 && kos.longitude === 0) return null;

    const straightKm = haversineKm(kos.latitude, kos.longitude, dest.latitude, dest.longitude);
    if (straightKm > 60) return null;

    const promise = (async (): Promise<CachedRoute | null> => {
      this.activeRequests++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const coords = `${kos.longitude},${kos.latitude};${dest.longitude},${dest.latitude}`;
        const url = `${this.baseUrl}/route/v1/driving/${coords}?overview=false`;
        const res = await this.fetchFn(url, {
          method: 'GET',
          headers: { Accept: 'application/json', 'User-Agent': 'KosMatch-Jakarta/1.0' },
          signal: controller.signal,
        });
        if (!res.ok) return null;
        const data = (await res.json()) as OsrmRoutePayload;
        const route = data.routes?.[0];
        if (data.code !== 'Ok' || !route || typeof route.distance !== 'number' || typeof route.duration !== 'number') {
          return null;
        }
        const distanceKm = Math.max(0.1, round1(route.distance / 1000));
        const drivingDurationMin = Math.max(1, route.duration / 60);
        const result: CachedRoute = { distanceKm, drivingDurationMin };
        this.cache.set(key, result);
        return result;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
        this.activeRequests--;
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, promise);
    return promise;
  }

  async estimate(kos: Kos, dest: Destination, mode?: TransportMode): Promise<CommuteEstimate[]> {
    const route = await this.fetchRoute(kos, dest);
    if (!route) {
      return this.fallback.estimate(kos, dest, mode);
    }

    const { distanceKm: km, drivingDurationMin } = route;
    // Motorcycle (ojek) in Jakarta traffic is typically ~15% faster than 4-wheel driving
    const ojekMinutes = Math.max(3, ceilMinutes(drivingDurationMin * 0.85));

    const base = { destinationId: dest.id, distanceKm: km, isEstimate: true, source: 'mock' } as const;
    const all: CommuteEstimate[] = [
      {
        ...base,
        mode: 'ojek',
        durationMin: ojekMinutes,
        costRp: Math.max(8000, roundTo500(3000 * km)),
        transitTransfers: 0,
      },
      {
        ...base,
        mode: 'transit',
        durationMin: ceilMinutes((km / 28) * 60 + 10),
        costRp: Math.min(10000, roundTo500(3000 + 300 * km)),
        transitTransfers: km < 5 ? 0 : km < 15 ? 1 : 2,
      },
    ];

    if (km <= 1.5) {
      all.push({
        ...base,
        mode: 'jalan_kaki',
        durationMin: ceilMinutes((km / 4.5) * 60),
        costRp: 0,
        transitTransfers: 0,
      });
    }

    return mode ? all.filter((e) => e.mode === mode) : all;
  }
}
