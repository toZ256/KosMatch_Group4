import type { CommuteEstimate, Destination, Kos, TransportMode } from '@kosmatch/shared';

/** Estimates commute between a kos and a destination. Services depend on this interface only. */
export interface CommuteProvider {
  estimate(kos: Kos, dest: Destination, mode?: TransportMode): Promise<CommuteEstimate[]>;
}
