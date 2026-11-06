import {
  CHATBOT_MAX_RESULTS,
  ChatParamsSchema,
  type ChatbotResponse,
  type ChatbotResultItem,
  type CommuteEstimate,
  type Destination,
  type Kos,
} from '@kosmatch/shared';
import type { Repository } from '../data/repository';
import type { CommuteProvider } from '../providers/commute';
import { haversineKm } from '../providers/commute/MockCommuteProvider';
import type { LlmProvider } from '../providers/llm';

const MAX_COMMUTE_CANDIDATES = 12;

const FACILITY_SYNONYMS: Array<{ pattern: RegExp; facility: string }> = [
  { pattern: /\bac\b/i, facility: 'ac' },
  { pattern: /\b(wifi|wi-fi|internet)\b/i, facility: 'wifi' },
  { pattern: /\b(km dal[ae]m|kamar mandi dal[ae]m|k\.\s*mandi dal[ae]m)\b/i, facility: 'mandi dalam' },
  { pattern: /\b(parkir|motor|mobil)\b/i, facility: 'parkir' },
  { pattern: /\bkasur\b/i, facility: 'kasur' },
  { pattern: /\blemari\b/i, facility: 'lemari' },
  { pattern: /\bdapur\b/i, facility: 'dapur' },
  { pattern: /\bmeja\b/i, facility: 'meja' },
];

/** Checks whether a Kos has a requested facility (normalizing CSV and seed naming differences). */
export function kosHasFacility(kos: Kos, requested: string): boolean {
  const req = requested.toLowerCase().trim();
  const list = kos.fasilitas.map((f) => f.toLowerCase().trim());

  if (req.includes('mandi dalam') || req.includes('mandi dalem') || req.includes('km dalam') || req.includes('km dalem')) {
    return list.some((f) => f.includes('mandi dalam') || f.includes('km dalam'));
  }
  if (req === 'ac') {
    return list.some((f) => f === 'ac' || f.startsWith('ac '));
  }
  if (req === 'wifi') {
    return list.some((f) => f.includes('wifi') || f.includes('wi-fi'));
  }
  return list.some((f) => f.includes(req));
}

/**
 * Computes a RAG keyword/facility match bonus (0..10 points) between user query and Kos document.
 * Higher bonus lowers the penalty score so matching kos rank higher.
 */
export function computeRagRelevanceBonus(kos: Kos, message: string, areaKeywords?: string[]): number {
  const query = message.toLowerCase();
  const kosFacilities = kos.fasilitas.map((f) => f.toLowerCase());
  const kosDoc = `${kos.namaKos} ${kos.area} ${kos.deskripsi} ${kosFacilities.join(' ')}`.toLowerCase();

  let bonus = 0;
  for (const { pattern, facility } of FACILITY_SYNONYMS) {
    if (pattern.test(query) && kosFacilities.some((f) => f.includes(facility))) {
      bonus += 2.5;
    }
  }

  if (areaKeywords && areaKeywords.length > 0) {
    for (const kw of areaKeywords) {
      if (kos.area.toLowerCase().includes(kw.toLowerCase()) || kos.namaKos.toLowerCase().includes(kw.toLowerCase())) {
        bonus += 3;
        break;
      }
    }
  }

  // Area match bonus from raw message
  const areaTokens = kos.area
    .toLowerCase()
    .split(/[\s,/()-]+/)
    .filter((t) => t.length >= 4);
  for (const token of areaTokens) {
    if (query.includes(token)) {
      bonus += 2.5;
      break;
    }
  }

  // General keyword overlap on description/title
  const queryWords = query
    .split(/[^a-z0-9]+/)
    .filter(
      (w) =>
        w.length >= 4 &&
        ![
          'cari',
          'carikan',
          'tolong',
          'koskosan',
          'dekat',
          'budget',
          'range',
          'juta',
          'ribu',
          'menit',
          'yang',
          'untuk',
          'jangan',
          'lebih',
          'kurang',
          'kemudian',
        ].includes(w),
    );
  for (const word of queryWords) {
    if (kosDoc.includes(word)) {
      bonus += 0.5;
    }
  }

  return Math.min(10, bonus);
}

/** Pre-filters large datasets (e.g. 2,300+ rows in PostgreSQL) to the top closest & most relevant candidates. */
function selectTopCandidates(
  kosList: Kos[],
  dest: Destination | null,
  message: string,
  limit: number,
  areaKeywords?: string[],
): Kos[] {
  if (kosList.length <= limit) {
    return kosList;
  }
  return [...kosList]
    .map((kos) => {
      const distKm = dest ? haversineKm(kos.latitude, kos.longitude, dest.latitude, dest.longitude) : 0;
      const ragBonus = computeRagRelevanceBonus(kos, message, areaKeywords);
      // Prioritize proximity to destination, rating, and RAG relevance over raw cheapness
      const preScore = distKm * 4 + kos.hargaSewa / 1_000_000 - kos.rating * 1.2 - ragBonus;
      return { kos, preScore };
    })
    .sort((a, b) => a.preScore - b.preScore)
    .slice(0, limit)
    .map((x) => x.kos);
}

export class ChatbotService {
  constructor(
    private readonly repo: Repository,
    private readonly llm: LlmProvider,
    private readonly commute: CommuteProvider,
  ) {}

  async ask(message: string): Promise<ChatbotResponse> {
    const destinations = await this.repo.destinations.list();
    // Validate provider output before it is used for querying.
    const params = ChatParamsSchema.parse(await this.llm.extractParams(message, destinations));

    const hasAnyCriteria = Boolean(
      params.destinationId ||
        params.maxBudgetMonthly ||
        params.minBudgetMonthly ||
        (params.fasilitas && params.fasilitas.length > 0) ||
        (params.areaKeywords && params.areaKeywords.length > 0) ||
        (params.unsupportedRequests && params.unsupportedRequests.length > 0),
    );

    // Not enough information: ask for clarification (not an error).
    if (!hasAnyCriteria) {
      return {
        reply: await this.llm.composeReply(params, 0, { message, results: [], destination: null }),
        params,
        results: [],
        noResults: false,
      };
    }

    const hasUnsupportedDest = params.unsupportedRequests?.some(
      (u) => u.startsWith('Kampus ') || u.startsWith('Titik ') || u.startsWith('Universitas ') || u.includes('Institute'),
    );

    // If user asked for an unregistered campus/destination and gave no valid area in Jabodetabek:
    // Do not guess or pick random kos from across the region. Explain directly that it is not registered.
    if (hasUnsupportedDest && !params.destinationId && (!params.areaKeywords || params.areaKeywords.length === 0)) {
      return {
        reply: await this.llm.composeReply(params, 0, {
          message,
          results: [],
          destination: null,
          unsupportedRequests: params.unsupportedRequests,
        }),
        params,
        results: [],
        noResults: false,
      };
    }

    const rawKosList = await this.repo.kos.list({
      minPrice: params.minBudgetMonthly,
      maxPrice: params.maxBudgetMonthly,
      tipe: params.tipe,
    });

    // Enforce strict budget range, required facilities, electricity, and area filtering extracted by AI
    const filteredKosList = rawKosList.filter((kos) => {
      if (params.minBudgetMonthly !== undefined && kos.hargaSewa < params.minBudgetMonthly) return false;
      if (params.maxBudgetMonthly !== undefined && kos.hargaSewa > params.maxBudgetMonthly) return false;
      if (params.fasilitas && params.fasilitas.length > 0) {
        const hasAll = params.fasilitas.every((reqFac) => kosHasFacility(kos, reqFac));
        if (!hasAll) return false;
      }
      if (params.listrikTermasuk === true) {
        if (!kos.deskripsi.toLowerCase().includes('termasuk listrik')) return false;
      }
      if (params.areaKeywords && params.areaKeywords.length > 0 && !params.destinationId) {
        const hay = `${kos.area} ${kos.namaKos} ${kos.deskripsi}`.toLowerCase();
        const matchesArea = params.areaKeywords.some((kw) => hay.includes(kw.toLowerCase()));
        if (!matchesArea) return false;
      }
      return true;
    });

    const dest = params.destinationId ? await this.repo.destinations.get(params.destinationId) : null;

    let isFallback = false;
    let fallbackReason: string | undefined;
    let candidates: Kos[] = [];

    if (filteredKosList.length > 0) {
      candidates = selectTopCandidates(
        filteredKosList,
        dest,
        message,
        MAX_COMMUTE_CANDIDATES,
        params.areaKeywords,
      );
    } else {
      // 3. Fallback Strategy: Never leave an empty screen (0 results).
      // Automatically relax criteria to find nearest/most affordable alternatives.
      isFallback = true;
      if (params.maxBudgetMonthly) {
        fallbackReason = 'budget_terlalu_rendah';
      } else if (params.fasilitas && params.fasilitas.length > 0) {
        fallbackReason = 'fasilitas_terlalu_ketat';
      } else if (params.maxCommuteMin) {
        fallbackReason = 'waktu_tempuh_terlalu_singkat';
      } else if (params.areaKeywords && params.areaKeywords.length > 0) {
        fallbackReason = 'area_belum_tersedia';
      } else {
        fallbackReason = 'kriteria_terlalu_ketat';
      }

      // Fetch all kos matching type (or all if not specified)
      const allKos = await this.repo.kos.list({ tipe: params.tipe });
      const alternatives = [...allKos].sort((a, b) => {
        if (dest) {
          const distA = haversineKm(a.latitude, a.longitude, dest.latitude, dest.longitude);
          const distB = haversineKm(b.latitude, b.longitude, dest.latitude, dest.longitude);
          return distA - distB || a.hargaSewa - b.hargaSewa;
        }
        return a.hargaSewa - b.hargaSewa || b.rating - a.rating;
      });

      candidates = alternatives.slice(0, MAX_COMMUTE_CANDIDATES);
    }

    // Evaluate commute in parallel (Promise.all) instead of sequentially so response is fast (<1.5s)
    const evaluated = await Promise.all(
      candidates.map(async (kos): Promise<{ item: ChatbotResultItem; score: number } | null> => {
        const ragBonus = computeRagRelevanceBonus(kos, message, params.areaKeywords);
        if (!dest) {
          return {
            item: { kos, commute: [] },
            score: kos.hargaSewa / 500_000 - kos.rating - ragBonus,
          };
        }
        const estimates = await this.commute.estimate(kos, dest, params.preferredMode);
        // In fallback mode, provide all valid routes without eliminating candidates
        const matching = isFallback
          ? estimates
          : estimates.filter(
              (e: CommuteEstimate) =>
                (params.maxCommuteMin === undefined || e.durationMin <= params.maxCommuteMin) &&
                (params.maxCommuteCostRp === undefined || e.costRp <= params.maxCommuteCostRp),
            );
        if (matching.length === 0) return null;
        matching.sort((a, b) => a.durationMin - b.durationMin);
        const best = matching[0];
        if (!best) return null;
        return {
          item: { kos, commute: matching },
          score: best.durationMin + kos.hargaSewa / 500_000 - kos.rating * 0.5 - ragBonus * 0.5,
        };
      }),
    );

    const scored = evaluated.filter((x): x is { item: ChatbotResultItem; score: number } => x !== null);
    scored.sort((a, b) => a.score - b.score);
    const results = scored.slice(0, CHATBOT_MAX_RESULTS).map((s) => s.item);

    const reply = await this.llm.composeReply(params, results.length, {
      message,
      results,
      destination: dest,
      isFallback,
      fallbackReason,
      unsupportedRequests: params.unsupportedRequests,
    });

    return {
      reply,
      params,
      results,
      noResults: results.length === 0,
      isFallback,
      fallbackReason,
      unsupportedRequests: params.unsupportedRequests,
    };
  }
}
