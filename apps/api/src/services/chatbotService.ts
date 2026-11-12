import {
  CHATBOT_MAX_RESULTS,
  matchKosToLocation,
  resolveLocationQuery,
  type ChatbotResponse,
  type ChatbotResultItem,
  type CommuteEstimate,
  type Destination,
  type Kos,
  type ResolvedLocation,
} from '@kosmatch/shared';
import type { Repository } from '../data/repository';
import { defaultGeocoder, type CommuteProvider } from '../providers/commute';
import { haversineKm } from '../providers/commute/MockCommuteProvider';
import {
  AgentOrchestrator,
  extractMentionedIndices,
  extractMentionedKosIds,
  hasExplicitAgentToolIntent,
  type AgentAskOptions,
  type LlmProvider,
} from '../providers/llm';

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
    for (let i = 0; i < areaKeywords.length; i++) {
      const kw = areaKeywords[i]!.toLowerCase();
      if (kos.area.toLowerCase().includes(kw) || kos.namaKos.toLowerCase().includes(kw)) {
        bonus += i === 0 ? 5.5 : i === 1 ? 4.5 : 3;
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
  resolvedAreaLoc?: ResolvedLocation | null,
): Kos[] {
  return [...kosList]
    .map((kos) => {
      const distKm = dest ? haversineKm(kos.latitude, kos.longitude, dest.latitude, dest.longitude) : 0;
      const ragBonus = computeRagRelevanceBonus(kos, message, areaKeywords);
      const locMatch = resolvedAreaLoc ? matchKosToLocation(kos, resolvedAreaLoc) : null;
      const corridorBonus = locMatch
        ? (locMatch.isPrimaryMatch ? 12 : 0) + (locMatch.isNearbyAreaMatch ? 6 : 0) + (locMatch.isWithinRadius ? 4 : 0)
        : 0;
      // Prioritize proximity to destination/corridor, corridor sub-area match, rating, and RAG relevance
      const preScore = distKm * 4 + kos.hargaSewa / 1_000_000 - kos.rating * 1.2 - ragBonus - corridorBonus;
      return { kos, preScore };
    })
    .sort((a, b) => a.preScore - b.preScore)
    .slice(0, limit)
    .map((x) => x.kos);
}

export class ChatbotService {
  private readonly orchestrator: AgentOrchestrator;

  constructor(
    private readonly repo: Repository,
    private readonly llm: LlmProvider,
    private readonly commute: CommuteProvider,
  ) {
    this.orchestrator = new AgentOrchestrator(repo, llm, commute);
  }

  async ask(message: string, options?: AgentAskOptions): Promise<ChatbotResponse> {
    // Layer 1: Input Guardrails (Prompt Injection, Out-of-Scope Firewall, Toxic Filter, PII Redaction)
    const guardrailCheck = this.orchestrator.runInputGuardrails(message);
    if (guardrailCheck.blockedResponse) {
      return guardrailCheck.blockedResponse;
    }

    const { sanitizedMessage, piiRedacted } = guardrailCheck;
    const piiMeta = piiRedacted
      ? {
          guardrailNotice: 'Data sensitif (PII) pada pesan Anda telah disensor otomatis demi keamanan privasi.',
          sanitizedMessage,
        }
      : {};

    const destinations = await this.repo.destinations.list();
    const allKos = await this.repo.kos.list();
    const validKosMap = new Map<string, Kos>(allKos.map((k) => [k.id, k]));

    // Validate provider output via Layer 4 Circuit Breaker before querying.
    const params = await this.orchestrator.safeExtractParams(sanitizedMessage, destinations);

    const hasAnyCriteria = Boolean(
      params.destinationId ||
        params.maxBudgetMonthly ||
        params.minBudgetMonthly ||
        params.tipe ||
        (params.fasilitas && params.fasilitas.length > 0) ||
        (params.areaKeywords && params.areaKeywords.length > 0) ||
        (params.unsupportedRequests && params.unsupportedRequests.length > 0),
    );

    const explicitToolIntent = hasExplicitAgentToolIntent(sanitizedMessage);
    const mentionedKosIds = extractMentionedKosIds(sanitizedMessage, allKos);
    const mentionedIndices = extractMentionedIndices(sanitizedMessage);

    // Not enough information and no agentic tool intent: ask for clarification (not an error).
    if (!hasAnyCriteria && !explicitToolIntent && mentionedKosIds.length === 0) {
      return {
        reply: await this.orchestrator.safeComposeReply(params, 0, {
          message: sanitizedMessage,
          results: [],
          destination: null,
        }),
        params,
        results: [],
        noResults: false,
        actions: [],
        aiMode: this.orchestrator.getLastAiMode(),
        ...piiMeta,
      };
    }

    const hasUnsupportedDest = params.unsupportedRequests?.some(
      (u) =>
        u.startsWith('Kampus ') ||
        u.startsWith('Kampus/Titik ') ||
        u.startsWith('Titik ') ||
        u.startsWith('Universitas ') ||
        u.includes('Institute'),
    );

    // If user asked for an unregistered campus/destination and gave no valid area in Jabodetabek:
    // Do not guess or pick random kos from across the region. Explain directly that it is not registered.
    if (
      hasUnsupportedDest &&
      !params.destinationId &&
      (!params.areaKeywords || params.areaKeywords.length === 0) &&
      !explicitToolIntent
    ) {
      return {
        reply: await this.orchestrator.safeComposeReply(params, 0, {
          message: sanitizedMessage,
          results: [],
          destination: null,
          unsupportedRequests: params.unsupportedRequests,
        }),
        params,
        results: [],
        noResults: false,
        actions: [],
        aiMode: this.orchestrator.getLastAiMode(),
        ...piiMeta,
      };
    }

    // Handle direct tool invocation without search criteria (e.g. "Tolong simpan kos nomor 1 dan 3", "Bandingkan Kos Andalan UI dan Kos Tebet Hijau", "Chat WA pemilik Kos Andalan UI")
    if (!hasAnyCriteria && (explicitToolIntent || mentionedKosIds.length > 0)) {
      const targetIds =
        mentionedKosIds.length > 0
          ? mentionedKosIds
          : mentionedIndices.length > 0
            ? mentionedIndices.map((idx) => allKos[idx - 1]?.id).filter((id): id is string => typeof id === 'string')
            : allKos.slice(0, 2).map((k) => k.id);

      const defaultDest = destinations[0] ?? null;
      const directResults: ChatbotResultItem[] = await Promise.all(
        targetIds.slice(0, CHATBOT_MAX_RESULTS).map(async (id) => {
          const kos = validKosMap.get(id)!;
          const commute = defaultDest ? await this.commute.estimate(kos, defaultDest) : [];
          return { kos, commute };
        }),
      );

      const proposedCalls = await this.orchestrator.safeDetectToolCalls(sanitizedMessage, {
        results: directResults,
        allKos,
        destinations,
        params,
      });

      const { actions, toolReplyNotes } = await this.orchestrator.executeTools(proposedCalls, {
        validKosMap,
        results: directResults,
        allKos,
        destinations,
        params,
        userId: options?.userId,
      });

      const directReply =
        toolReplyNotes.length > 0
          ? `${toolReplyNotes.join(' ')} Estimasi waktu dan biaya perjalanan bersifat perkiraan.`
          : await this.orchestrator.safeComposeReply(params, directResults.length, {
              message: sanitizedMessage,
              results: directResults,
              destination: defaultDest,
            });

      return this.orchestrator.applyOutputGuardrails(
        {
          reply: directReply,
          params,
          results: directResults,
          noResults: directResults.length === 0,
          actions,
          ...piiMeta,
        },
        validKosMap,
      );
    }

    const rawKosList = await this.repo.kos.list({
      minPrice: params.minBudgetMonthly,
      maxPrice: params.maxBudgetMonthly,
      tipe: params.tipe,
    });

    const resolvedAreaLoc = !params.destinationId
      ? resolveLocationQuery(sanitizedMessage) ??
        (params.areaKeywords?.[0] ? resolveLocationQuery(params.areaKeywords[0]) : null) ??
        (params.areaKeywords?.[0] ? await defaultGeocoder.resolve(params.areaKeywords[0]) : null)
      : null;

    // Enforce strict budget range, required facilities, electricity, and area/corridor filtering
    const baseFilteredKos = rawKosList.filter((kos) => {
      if (params.minBudgetMonthly !== undefined && kos.hargaSewa < params.minBudgetMonthly) return false;
      if (params.maxBudgetMonthly !== undefined && kos.hargaSewa > params.maxBudgetMonthly) return false;
      if (params.fasilitas && params.fasilitas.length > 0) {
        const hasAll = params.fasilitas.every((reqFac) => kosHasFacility(kos, reqFac));
        if (!hasAll) return false;
      }
      if (params.listrikTermasuk === true) {
        if (!kos.deskripsi.toLowerCase().includes('termasuk listrik')) return false;
      }
      return true;
    });

    let filteredKosList = baseFilteredKos;
    if (!params.destinationId && ((params.areaKeywords && params.areaKeywords.length > 0) || resolvedAreaLoc)) {
      // First try strict corridor/sub-area + spatial radius match so specific surrounding districts win
      const strictAreaMatches = baseFilteredKos.filter((kos) => {
        if (resolvedAreaLoc && matchKosToLocation(kos, resolvedAreaLoc).matches) {
          return true;
        }
        if (params.areaKeywords && params.areaKeywords.length > 0) {
          const hay = `${kos.area} ${kos.namaKos} ${kos.deskripsi}`.toLowerCase();
          const specificKws = params.areaKeywords.filter(
            (kw) =>
              !kw.toLowerCase().startsWith('jakarta ') ||
              resolvedAreaLoc?.hub.id.startsWith('wilayah-jakarta-'),
          );
          if (specificKws.some((kw) => hay.includes(kw.toLowerCase()))) {
            return true;
          }
        }
        return false;
      });

      if (strictAreaMatches.length > 0) {
        filteredKosList = strictAreaMatches;
      } else if (params.areaKeywords && params.areaKeywords.length > 0) {
        // Fallback to broad city/region match (e.g. 'Jakarta Selatan') if no specific sub-area matched
        filteredKosList = baseFilteredKos.filter((kos) => {
          const hay = `${kos.area} ${kos.namaKos} ${kos.deskripsi}`.toLowerCase();
          return params.areaKeywords!.some((kw) => hay.includes(kw.toLowerCase()));
        });
      }
    }

    const dest = params.destinationId ? await this.repo.destinations.get(params.destinationId) : null;
    // Use resolved corridor/area anchor coordinates as virtual destination when no catalog destinationId is set
    const effectiveDest = dest ?? (!hasUnsupportedDest ? resolvedAreaLoc?.virtualDestination ?? null : null);

    let isFallback = false;
    let fallbackReason: string | undefined;
    let candidates: Kos[] = [];

    if (filteredKosList.length > 0) {
      candidates = selectTopCandidates(
        filteredKosList,
        effectiveDest,
        sanitizedMessage,
        MAX_COMMUTE_CANDIDATES,
        params.areaKeywords,
        resolvedAreaLoc,
      );
    } else {
      // Fallback Strategy: Never leave an empty screen (0 results).
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

      const allMatchingType = await this.repo.kos.list({ tipe: params.tipe });
      const alternatives = [...allMatchingType].sort((a, b) => {
        if (effectiveDest) {
          const distA = haversineKm(a.latitude, a.longitude, effectiveDest.latitude, effectiveDest.longitude);
          const distB = haversineKm(b.latitude, b.longitude, effectiveDest.latitude, effectiveDest.longitude);
          return distA - distB || a.hargaSewa - b.hargaSewa;
        }
        return a.hargaSewa - b.hargaSewa || b.rating - a.rating;
      });

      candidates = alternatives.slice(0, MAX_COMMUTE_CANDIDATES);
    }

    // Evaluate commute in parallel (Promise.all) instead of sequentially so response is fast (<1.5s)
    const evaluated = await Promise.all(
      candidates.map(async (kos): Promise<{ item: ChatbotResultItem; score: number } | null> => {
        const ragBonus = computeRagRelevanceBonus(kos, sanitizedMessage, params.areaKeywords);
        const locMatch = resolvedAreaLoc ? matchKosToLocation(kos, resolvedAreaLoc) : null;
        const corridorBonus = locMatch
          ? (locMatch.isPrimaryMatch ? 8 : 0) + (locMatch.isNearbyAreaMatch ? 4 : 0) + (locMatch.isWithinRadius ? 2 : 0)
          : 0;

        if (!effectiveDest) {
          const closestDest =
            destinations.length > 0
              ? destinations.reduce((best, cur) => {
                  const dBest = haversineKm(kos.latitude, kos.longitude, best.latitude, best.longitude);
                  const dCur = haversineKm(kos.latitude, kos.longitude, cur.latitude, cur.longitude);
                  return dCur < dBest ? cur : best;
                })
              : null;
          const fallbackEstimates = closestDest
            ? await this.commute.estimate(kos, closestDest, params.preferredMode)
            : [];
          return {
            item: { kos, commute: fallbackEstimates },
            score: kos.hargaSewa / 500_000 - kos.rating - ragBonus - corridorBonus,
          };
        }
        const estimates = await this.commute.estimate(kos, effectiveDest, params.preferredMode);
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
          score: best.durationMin + kos.hargaSewa / 500_000 - kos.rating * 0.5 - ragBonus * 0.5 - corridorBonus,
        };
      }),
    );

    const scored = evaluated.filter((x): x is { item: ChatbotResultItem; score: number } => x !== null);
    scored.sort((a, b) => a.score - b.score);
    const results = scored.slice(0, CHATBOT_MAX_RESULTS).map((s) => s.item);

    // Layer 2: Detect & execute agentic tool calls
    const proposedCalls = await this.orchestrator.safeDetectToolCalls(sanitizedMessage, {
      results,
      allKos,
      destinations,
      params,
    });

    const { actions, toolReplyNotes } = await this.orchestrator.executeTools(proposedCalls, {
      validKosMap,
      results,
      allKos,
      destinations,
      params,
      userId: options?.userId,
    });

    const baseReply = await this.orchestrator.safeComposeReply(params, results.length, {
      message: sanitizedMessage,
      results,
      destination: dest,
      isFallback,
      fallbackReason,
      unsupportedRequests: params.unsupportedRequests,
    });

    const combinedReply =
      toolReplyNotes.length > 0 ? `${baseReply}\n\n${toolReplyNotes.join(' ')}` : baseReply;

    // Layer 3: Output & Grounding Guardrails
    return this.orchestrator.applyOutputGuardrails(
      {
        reply: combinedReply,
        params,
        results,
        noResults: results.length === 0,
        isFallback,
        fallbackReason,
        unsupportedRequests: params.unsupportedRequests,
        actions,
        ...piiMeta,
      },
      validKosMap,
    );
  }
}
