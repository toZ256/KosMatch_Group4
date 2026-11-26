import {
  calculateDistanceKm,
  matchKosToLocation,
  resolveLocationQuery,
  type CommuteEstimate,
  type Destination,
  type Kos,
  type KosFormOutput,
  type KosWithCommute,
  type TipeKos,
} from '@kosmatch/shared';
import type { Repository } from '../data/repository';
import { AppError } from '../middleware/http';
import { defaultGeocoder, type CommuteProvider } from '../providers/commute';
import { MockCommuteProvider } from '../providers/commute/MockCommuteProvider';

const PHOTO_COLORS = ['#E8B4A0', '#B8C4D6', '#D9C7A3', '#A9C7C5', '#E3B7C8', '#C5D3A8', '#B5B9E0'];
const fastCommuteFallback = new MockCommuteProvider();

export interface CustomDestinationParams {
  destinationId?: string;
  destLat?: number;
  destLng?: number;
  destName?: string;
}

export class KosService {
  constructor(
    private readonly repo: Repository,
    private readonly commute: CommuteProvider,
  ) {}

  private async resolveTargetDestination(params: CustomDestinationParams): Promise<Destination | null> {
    if (params.destinationId) {
      const found =
        (await this.repo.destinations.get(params.destinationId)) ??
        resolveLocationQuery(params.destinationId)?.virtualDestination ??
        null;
      if (found) return found;
    }
    if (params.destLat !== undefined && params.destLng !== undefined) {
      return {
        id: params.destinationId || `custom:${params.destLat.toFixed(5)},${params.destLng.toFixed(5)}`,
        nama: params.destName?.trim() || 'Lokasi Tujuan',
        kategori: 'kantor',
        latitude: params.destLat,
        longitude: params.destLng,
        aliases: [],
      };
    }
    return null;
  }

  async list(
    query: {
      q?: string;
      maxPrice?: number;
      tipe?: TipeKos;
      limit?: number;
      sort?: 'rating' | 'price_asc' | 'price_desc';
    } & CustomDestinationParams,
  ) {
    const { destinationId, destLat, destLng, destName, limit, sort, ...filter } = query;
    const hubFromDestId = destinationId ? resolveLocationQuery(destinationId) : null;
    const effectiveFilter =
      !filter.q && hubFromDestId ? { ...filter, q: hubFromDestId.hub.name } : filter;

    const hasExplicitDest = Boolean(destinationId) || (destLat !== undefined && destLng !== undefined);
    const canPushLimitToRepo = !hasExplicitDest && !effectiveFilter.q?.trim();
    let kosList = await this.repo.kos.list(
      canPushLimitToRepo ? { ...effectiveFilter, sort, limit } : effectiveFilter,
    );

    const resolvedLoc = effectiveFilter.q?.trim()
      ? await defaultGeocoder.resolve(effectiveFilter.q)
      : hubFromDestId;

    // If repository returned 0 items for a dynamic OpenStreetMap location (e.g. "Senayan City", "GBK", "Menara 165"),
    // filter by spatial radius & nearby areas around the geocoded building coordinates
    if (kosList.length === 0 && resolvedLoc) {
      const allCandidates = await this.repo.kos.list({
        maxPrice: filter.maxPrice,
        tipe: filter.tipe,
      });
      kosList = allCandidates
        .map((k) => ({ kos: k, locMatch: matchKosToLocation(k, resolvedLoc) }))
        .filter(({ locMatch }) => locMatch.matches)
        .sort((a, b) => a.locMatch.relevanceScore - b.locMatch.relevanceScore)
        .map(({ kos }) => kos);
    }

    if (sort === 'rating') {
      kosList = [...kosList].sort((a, b) => b.rating - a.rating);
    } else if (sort === 'price_asc') {
      kosList = [...kosList].sort((a, b) => a.hargaSewa - b.hargaSewa);
    } else if (sort === 'price_desc') {
      kosList = [...kosList].sort((a, b) => b.hargaSewa - a.hargaSewa);
    }

    if (limit !== undefined && limit > 0) {
      kosList = kosList.slice(0, limit);
    }

    if (hasExplicitDest) {
      const dest = await this.resolveTargetDestination({ destinationId, destLat, destLng, destName });
      if (!dest) throw new AppError('NOT_FOUND', 'Destinasi tidak ditemukan');

      // When searching purely by a custom building/place coordinate (without keyword filter),
      // rank nearest kos first so the user immediately sees relevant nearby listings
      if (!effectiveFilter.q && destLat !== undefined && destLng !== undefined) {
        kosList = [...kosList].sort(
          (a, b) =>
            calculateDistanceKm(a.latitude, a.longitude, dest.latitude, dest.longitude) -
            calculateDistanceKm(b.latitude, b.longitude, dest.latitude, dest.longitude),
        );
      }

      return Promise.all(
        kosList.map(
          async (k, idx): Promise<KosWithCommute> => ({
            ...k,
            commute:
              idx < 12
                ? await this.commute.estimate(k, dest)
                : await fastCommuteFallback.estimate(k, dest),
          }),
        ),
      );
    }

    // When user searches a major corridor/building in the search bar (e.g. "TB Simatupang" or "Senayan City"),
    // automatically attach commute estimates to that location's anchor coordinates.
    if (resolvedLoc) {
      const virtualDest = resolvedLoc.virtualDestination;
      return Promise.all(
        kosList.map(
          async (k, idx): Promise<KosWithCommute> => ({
            ...k,
            commute:
              idx < 12
                ? await this.commute.estimate(k, virtualDest)
                : await fastCommuteFallback.estimate(k, virtualDest),
          }),
        ),
      );
    }

    return kosList as KosWithCommute[];
  }

  async get(id: string, target?: string | CustomDestinationParams): Promise<KosWithCommute> {
    const kos = await this.repo.kos.get(id);
    if (!kos) throw new AppError('NOT_FOUND', 'Kos tidak ditemukan');
    const destParams: CustomDestinationParams =
      typeof target === 'string' ? { destinationId: target } : (target ?? {});
    const hasExplicitDest =
      Boolean(destParams.destinationId) ||
      (destParams.destLat !== undefined && destParams.destLng !== undefined);
    if (!hasExplicitDest) return kos;

    const dest = await this.resolveTargetDestination(destParams);
    if (!dest) throw new AppError('NOT_FOUND', 'Destinasi tidak ditemukan');
    return { ...kos, commute: await this.commute.estimate(kos, dest) };
  }

  async commuteFor(kosId: string, target: string | CustomDestinationParams): Promise<CommuteEstimate[]> {
    const kos = await this.repo.kos.get(kosId);
    if (!kos) throw new AppError('NOT_FOUND', 'Kos tidak ditemukan');
    const destParams: CustomDestinationParams =
      typeof target === 'string' ? { destinationId: target } : target;
    const dest = await this.resolveTargetDestination(destParams);
    if (!dest) throw new AppError('NOT_FOUND', 'Destinasi tidak ditemukan');
    return this.commute.estimate(kos, dest);
  }

  listByOwner(ownerId: string) {
    return this.repo.kos.listByOwner(ownerId);
  }

  create(ownerId: string, input: KosFormOutput): Promise<Kos> {
    const color = PHOTO_COLORS[input.namaKos.length % PHOTO_COLORS.length] ?? '#E8B4A0';
    // New kos has no reviews yet, so rating starts at 0 ("Baru" in the UI).
    return this.repo.kos.create({ ...input, ownerId, rating: 0, fotoColor: color });
  }

  async update(ownerId: string, id: string, input: KosFormOutput): Promise<Kos> {
    await this.assertOwner(ownerId, id);
    const updated = await this.repo.kos.update(id, input);
    if (!updated) throw new AppError('NOT_FOUND', 'Kos tidak ditemukan');
    return updated;
  }

  async remove(ownerId: string, id: string): Promise<void> {
    await this.assertOwner(ownerId, id);
    await this.repo.kos.remove(id);
  }

  private async assertOwner(ownerId: string, id: string): Promise<void> {
    const existing = await this.repo.kos.get(id);
    if (!existing) throw new AppError('NOT_FOUND', 'Kos tidak ditemukan');
    if (existing.ownerId !== ownerId) throw new AppError('FORBIDDEN', 'Kos ini bukan milikmu');
  }
}
