import type { CommuteEstimate, Destination, Kos, TransportMode } from '@kosmatch/shared';
import type { CommuteProvider } from './CommuteProvider';

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const round1 = (n: number) => Math.round(n * 10) / 10;
const roundTo500 = (n: number) => Math.round(n / 500) * 500;
/** Avoids float noise (e.g. 30.000000001) pushing ceil up by one minute. */
const ceilMinutes = (n: number) => Math.ceil(Number(n.toFixed(6)));

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Deterministic commute estimator. No network access. */
export class MockCommuteProvider implements CommuteProvider {
  async estimate(kos: Kos, dest: Destination, mode?: TransportMode): Promise<CommuteEstimate[]> {
    const straight = haversineKm(kos.latitude, kos.longitude, dest.latitude, dest.longitude);
    const km = round1(straight * 1.3);

    const base = { destinationId: dest.id, distanceKm: km, isEstimate: true, source: 'mock' } as const;
    const all: CommuteEstimate[] = [
      {
        ...base,
        mode: 'ojek',
        durationMin: ceilMinutes((km / 22) * 60),
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
