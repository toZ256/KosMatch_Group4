import {
  matchKosToLocation,
  resolveLocationQuery,
  type CommuteEstimate,
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

export class KosService {
  constructor(
    private readonly repo: Repository,
    private readonly commute: CommuteProvider,
  ) {}

  async list(query: { q?: string; maxPrice?: number; tipe?: TipeKos; destinationId?: string }) {
    const { destinationId, ...filter } = query;
    const hubFromDestId = destinationId ? resolveLocationQuery(destinationId) : null;
    const effectiveFilter =
      !filter.q && hubFromDestId ? { ...filter, q: hubFromDestId.hub.name } : filter;

    let kosList = await this.repo.kos.list(effectiveFilter);

    const resolvedLoc = effectiveFilter.q?.trim()
      ? await defaultGeocoder.resolve(effectiveFilter.q)
      : hubFromDestId;

    // If repository returned 0 items for a dynamic OpenStreetMap Nominatim location, filter by spatial radius & nearby areas
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

    if (destinationId) {
      const dest =
        (await this.repo.destinations.get(destinationId)) ??
        resolveLocationQuery(destinationId)?.virtualDestination ??
        null;
      if (!dest) throw new AppError('NOT_FOUND', 'Destinasi tidak ditemukan');
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

    // When user searches a major corridor/location in the search bar (e.g. "TB Simatupang"),
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

  async get(id: string, destinationId?: string): Promise<KosWithCommute> {
    const kos = await this.repo.kos.get(id);
    if (!kos) throw new AppError('NOT_FOUND', 'Kos tidak ditemukan');
    if (!destinationId) return kos;
    const dest =
      (await this.repo.destinations.get(destinationId)) ??
      resolveLocationQuery(destinationId)?.virtualDestination ??
      null;
    if (!dest) throw new AppError('NOT_FOUND', 'Destinasi tidak ditemukan');
    return { ...kos, commute: await this.commute.estimate(kos, dest) };
  }

  async commuteFor(kosId: string, destinationId: string): Promise<CommuteEstimate[]> {
    const kos = await this.repo.kos.get(kosId);
    if (!kos) throw new AppError('NOT_FOUND', 'Kos tidak ditemukan');
    const dest =
      (await this.repo.destinations.get(destinationId)) ??
      resolveLocationQuery(destinationId)?.virtualDestination ??
      null;
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
