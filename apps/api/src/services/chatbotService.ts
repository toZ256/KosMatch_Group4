import {
  CHATBOT_MAX_RESULTS,
  ChatParamsSchema,
  type ChatbotResponse,
  type ChatbotResultItem,
  type CommuteEstimate,
} from '@kosmatch/shared';
import type { Repository } from '../data/repository';
import type { CommuteProvider } from '../providers/commute';
import type { LlmProvider } from '../providers/llm';

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

    // Not enough information: ask for clarification (not an error).
    if (!params.destinationId && !params.maxBudgetMonthly) {
      return { reply: await this.llm.composeReply(params, 0), params, results: [], noResults: false };
    }

    const kosList = await this.repo.kos.list({ maxPrice: params.maxBudgetMonthly, tipe: params.tipe });
    const dest = params.destinationId ? await this.repo.destinations.get(params.destinationId) : null;

    const scored: { item: ChatbotResultItem; score: number }[] = [];
    for (const kos of kosList) {
      if (!dest) {
        scored.push({ item: { kos, commute: [] }, score: kos.hargaSewa / 100_000 - kos.rating });
        continue;
      }
      const estimates = await this.commute.estimate(kos, dest, params.preferredMode);
      const matching = estimates.filter(
        (e: CommuteEstimate) =>
          (params.maxCommuteMin === undefined || e.durationMin <= params.maxCommuteMin) &&
          (params.maxCommuteCostRp === undefined || e.costRp <= params.maxCommuteCostRp),
      );
      if (matching.length === 0) continue;
      matching.sort((a, b) => a.durationMin - b.durationMin);
      const best = matching[0];
      if (!best) continue;
      // Simple score: commute minutes + rent in units of Rp100.000 (lower is better).
      scored.push({ item: { kos, commute: matching }, score: best.durationMin + kos.hargaSewa / 100_000 });
    }

    scored.sort((a, b) => a.score - b.score);
    const results = scored.slice(0, CHATBOT_MAX_RESULTS).map((s) => s.item);
    return {
      reply: await this.llm.composeReply(params, results.length),
      params,
      results,
      noResults: results.length === 0,
    };
  }
}
