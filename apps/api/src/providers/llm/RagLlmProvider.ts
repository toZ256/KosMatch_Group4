import fs from 'node:fs';
import path from 'node:path';
import {
  AgentToolTypeSchema,
  ChatParamsSchema,
  MAX_TOOLS_PER_TURN,
  WhatsAppIntentSchema,
  type ChatbotResultItem,
  type ChatParams,
  type Destination,
} from '@kosmatch/shared';
import type { LlmProvider, ProposedToolCall, RagContext, ToolDetectionContext } from './LlmProvider';
import {
  MockLlmProvider,
  extractAreaKeywords,
  hasExplicitAgentToolIntent,
  isExplicitUnsupportedDestination,
} from './MockLlmProvider';

const formatRp = (n: number) => `Rp${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

const GOOGLE_AI_STUDIO_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const VERTEX_EXPRESS_BASE_URL = 'https://aiplatform.googleapis.com/v1/publishers/google';
const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

export interface RagLlmOptions {
  /** Base URL (defaults to Google AI Studio: https://generativelanguage.googleapis.com/v1beta) */
  baseUrl?: string;
  /** API Key from Google AI Studio (aistudio.google.com) */
  apiKey?: string;
  /** Target Gemini model (defaults to 'gemini-2.5-flash') */
  model?: string;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Custom fetch function for testing */
  fetchFn?: typeof fetch;
}

interface GeminiGenerateContentPayload {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

interface ChatCompletionPayload {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

interface ModelsListPayload {
  data?: Array<{
    id?: string;
  }>;
}

function toTitleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const STANDARD_FACILITY_MAP: Record<string, string> = {
  'kamar mandi dalam': 'Kamar Mandi Dalam',
  'km dalam': 'Kamar Mandi Dalam',
  'wc dalam': 'Kamar Mandi Dalam',
  'mandi sendiri': 'Kamar Mandi Dalam',
  'ac': 'AC',
  'ber-ac': 'AC',
  'dingin': 'AC',
  'wifi': 'WiFi',
  'wi-fi': 'WiFi',
  'internet': 'WiFi',
  'kasur': 'Kasur',
  'tempat tidur': 'Kasur',
  'lemari': 'Lemari',
  'lemari baju': 'Lemari',
  'meja': 'Meja',
  'meja belajar': 'Meja',
  'meja kerja': 'Meja',
  'dapur': 'Dapur',
  'dapur bersama': 'Dapur',
  'bisa masak': 'Dapur',
  'parkir': 'Parkir',
  'parkiran': 'Parkir',
  'kulkas': 'Kulkas',
  'tv': 'TV',
  'laundry': 'Laundry',
  'cctv': 'CCTV',
  'kloset duduk': 'Kloset Duduk',
  'shower': 'Shower',
  'air panas': 'Air Panas',
};

const GREETING_ONLY = /^(halo|hai|hi|hello|pagi|siang|sore|malam|permisi|tes|test|ping|p)\b[!.?\s]*$/i;
const MAX_CACHE_ENTRIES = 150;
const RAG_MAX_CONTEXT_ITEMS = 3;
const RAG_MAX_FACILITIES_PER_KOS = 4;

/**
 * Deterministic Pre-Analyzer: checks whether local rule/gazetteer extraction already
 * resolved the user's parameters so we can skip the expensive LLM extraction call (0 tokens).
 */
export function shouldBypassLlmExtraction(message: string, ruleParams: ChatParams): boolean {
  const trimmed = message.trim();
  if (trimmed.length < 4 || GREETING_ONLY.test(trimmed)) {
    return true;
  }

  // 1. Direct tool invocation (bookmark, WhatsApp draft, compare, search redirect) is handled locally
  if (hasExplicitAgentToolIntent(trimmed)) {
    return true;
  }

  const hasExtractedParams = Boolean(
    ruleParams.destinationId ||
      ruleParams.maxBudgetMonthly ||
      ruleParams.minBudgetMonthly ||
      ruleParams.maxCommuteMin ||
      ruleParams.maxCommuteCostRp ||
      ruleParams.preferredMode ||
      ruleParams.tipe ||
      ruleParams.listrikTermasuk !== undefined ||
      (ruleParams.fasilitas && ruleParams.fasilitas.length > 0) ||
      (ruleParams.areaKeywords && ruleParams.areaKeywords.length > 0) ||
      (ruleParams.unsupportedRequests && ruleParams.unsupportedRequests.length > 0),
  );

  if (!hasExtractedParams) {
    // Nothing was recognized locally -> let LLM attempt semantic slot extraction
    return false;
  }

  // 2. Check if user mentioned a campus/station keyword that was NOT resolved into destinationId or unsupportedRequests
  const mentionsUnresolvedCampus =
    /\b(kampus|universitas|institut|politeknik|sekolah\s+tinggi|stasiun|halte)\b/i.test(trimmed) &&
    !ruleParams.destinationId &&
    (!ruleParams.unsupportedRequests || ruleParams.unsupportedRequests.length === 0);
  if (mentionsUnresolvedCampus) {
    return false;
  }

  // 3. Check if user explicitly asked for a facility/feature ("fasilitas ...", "dilengkapi ...") that wasn't caught
  const mentionsUnresolvedFacility =
    /\b(fasilitas(?:nya)?|dilengkapi|lengkap\s+dengan)\b/i.test(trimmed) &&
    (!ruleParams.fasilitas || ruleParams.fasilitas.length === 0) &&
    (!ruleParams.unsupportedRequests || ruleParams.unsupportedRequests.length === 0);
  if (mentionsUnresolvedFacility) {
    return false;
  }

  // Parameters were cleanly extracted locally -> bypass LLM call to save tokens!
  return true;
}

function readDotenvValue(keys: string[]): string {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '../.env'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const content = fs.readFileSync(file, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq > 0) {
          const k = trimmed.slice(0, eq).trim();
          if (keys.includes(k)) {
            let val = trimmed.slice(eq + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (val) return val;
          }
        }
      }
    } catch {
      // ignore read error
    }
  }
  return '';
}

/**
 * RAG (Retrieval-Augmented Generation) & Agentic LLM Provider.
 * Translates natural/casual human prompts into structured database filters and structured tool calls,
 * and composes grounded recommendations with Layer 4 Circuit Breaker fallback to MockLlmProvider.
 */
export class RagLlmProvider implements LlmProvider {
  private readonly baseUrl: string;
  private readonly initialApiKey: string;
  private readonly configuredModel: string;
  private readonly timeoutMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly fallback = new MockLlmProvider();
  private resolvedModel: string | null = null;
  private workingGoogleBaseUrl: string | null = null;
  private readonly invalidKeys = new Set<string>();
  private lastParsedActions: ProposedToolCall[] = [];
  private lastAiMode: 'gemini' | 'mock' = 'mock';
  private readonly extractCache = new Map<string, ChatParams>();
  private readonly replyCache = new Map<string, string>();

  getLastAiMode(): 'gemini' | 'mock' {
    return this.lastAiMode;
  }

  private setBoundedCache<T>(map: Map<string, T>, key: string, value: T): void {
    if (map.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = map.keys().next().value;
      if (oldestKey !== undefined) map.delete(oldestKey);
    }
    map.set(key, value);
  }

  constructor(options: RagLlmOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.LLM_BASE_URL ?? GOOGLE_AI_STUDIO_BASE_URL).replace(/\/+$/, '');
    this.initialApiKey = options.apiKey ?? '';
    this.configuredModel = options.model ?? process.env.LLM_MODEL ?? DEFAULT_GEMINI_MODEL;
    this.timeoutMs = Math.min(options.timeoutMs ?? 4500, 5000);
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private getApiKey(): string {
    if (this.initialApiKey) return this.initialApiKey;
    return readDotenvValue(['GEMINI_API_KEY', 'LLM_API_KEY']) || process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || '';
  }

  private isGoogleEndpoint(): boolean {
    return (
      this.baseUrl.includes('generativelanguage.googleapis.com') ||
      this.baseUrl.includes('aiplatform.googleapis.com')
    );
  }

  private buildHeaders(apiKey: string): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (apiKey && !this.isGoogleEndpoint()) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    return headers;
  }

  private async resolveModelName(apiKey: string): Promise<string> {
    if (this.configuredModel && this.configuredModel !== 'auto') {
      return this.configuredModel;
    }
    if (this.isGoogleEndpoint()) {
      return DEFAULT_GEMINI_MODEL;
    }
    if (this.resolvedModel) {
      return this.resolvedModel;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    try {
      const res = await this.fetchFn(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: this.buildHeaders(apiKey),
        signal: controller.signal,
      });
      if (res.ok) {
        const body = (await res.json()) as ModelsListPayload;
        const firstId = body.data?.find((m) => typeof m.id === 'string' && m.id.trim().length > 0)?.id;
        if (firstId) {
          this.resolvedModel = firstId;
          return firstId;
        }
      }
    } catch {
      // Fallback to default model identifier
    } finally {
      clearTimeout(timer);
    }

    return DEFAULT_GEMINI_MODEL;
  }

  /** Calls Google AI Studio or Vertex AI Express native generateContent REST API with fast failover & token cap. */
  private async callGeminiNative(
    systemPrompt: string,
    userPrompt: string,
    temperature = 0.2,
    maxOutputTokens = 200,
  ): Promise<string | null> {
    const apiKey = this.getApiKey();
    if (!apiKey || this.invalidKeys.has(apiKey)) return null;

    const modelName = await this.resolveModelName(apiKey);
    const baseUrls = this.workingGoogleBaseUrl
      ? [this.workingGoogleBaseUrl]
      : apiKey.startsWith('AQ.')
        ? [VERTEX_EXPRESS_BASE_URL, this.baseUrl]
        : [this.baseUrl];

    let allAuthRejected = true;

    for (const base of baseUrls) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const url = `${base}/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(apiKey)}`;
        const res = await this.fetchFn(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: userPrompt }],
              },
            ],
            generationConfig: {
              temperature,
              maxOutputTokens,
            },
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          // Circuit breaker handles 429 rate-limit or 5xx errors gracefully
          if (res.status !== 400 && res.status !== 401 && res.status !== 403) {
            allAuthRejected = false;
          }
          continue;
        }
        allAuthRejected = false;
        const data = (await res.json()) as GeminiGenerateContentPayload;
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
        if (text) {
          this.workingGoogleBaseUrl = base;
          return text;
        }
      } catch {
        allAuthRejected = false;
      } finally {
        clearTimeout(timer);
      }
    }

    if (allAuthRejected) {
      this.invalidKeys.add(apiKey);
    }
    return null;
  }

  private async chatCompletion(
    systemPrompt: string,
    userPrompt: string,
    temperature = 0.2,
    maxOutputTokens = 200,
  ): Promise<string | null> {
    if (this.isGoogleEndpoint()) {
      return this.callGeminiNative(systemPrompt, userPrompt, temperature, maxOutputTokens);
    }

    const apiKey = this.getApiKey();
    const model = await this.resolveModelName(apiKey);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.buildHeaders(apiKey),
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature,
          max_tokens: maxOutputTokens,
        }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as ChatCompletionPayload;
      const content = data.choices?.[0]?.message?.content;
      return typeof content === 'string' && content.trim().length > 0 ? content.trim() : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async extractParams(message: string, destinations: Destination[]): Promise<ChatParams> {
    this.lastParsedActions = [];
    this.lastAiMode = 'mock';
    const ruleParams = await this.fallback.extractParams(message, destinations);
    const trimmed = message.trim();

    // Stage 0 Token Optimization: Pre-analyze locally and skip LLM call if parameters are already clear
    if (shouldBypassLlmExtraction(trimmed, ruleParams)) {
      return ruleParams;
    }

    const normalizedKey = trimmed.toLowerCase().replace(/\s+/g, ' ');
    const cachedParams = this.extractCache.get(normalizedKey);
    if (cachedParams) {
      return cachedParams;
    }

    // Compact token-optimized slot extraction prompt (~68% smaller than verbose prompt)
    const systemPrompt = [
      'Ekstrak parameter pencarian kos Jakarta ke JSON murni (tanpa markdown):',
      '- destination: kampus/stasiun/kantor utama (ui, binus, trisakti, unj, atma jaya, scbd, sudirman, thamrin, kuningan, stasiun sudirman/tebet/palmerah) atau kampus/POI lain. Jangan isi nama jalan/kecamatan.',
      '- area: jalan/koridor/kecamatan/kota Jabodetabek (mis. tb simatupang, cilandak, kemang, depok, bsd) atau null.',
      '- minBudgetMonthly, maxBudgetMonthly, maxCommuteMin, maxCommuteCostRp: number | null.',
      '- preferredMode: "ojek"|"transit"|"jalan_kaki"|null. tipe: "putra"|"putri"|"campur"|null.',
      '- rawFacilities: string[] frasa utuh (jangan potong frasa majemuk seperti "meja makan" atau "kursi pijat").',
      '- listrikTermasuk: boolean|null. toolCalls: Array<{"tool":"whatsapp_draft"|"bookmark_kos"|"compare_kos"|"search_redirect","intent"?:string,"kosIndices"?:number[]}>.',
    ].join('\n');

    const raw = await this.chatCompletion(systemPrompt, trimmed, 0, 160);
    if (!raw) return ruleParams;
    this.lastAiMode = 'gemini';

    try {
      const jsonMatch = /\{[\s\S]*\}/.exec(raw);
      if (!jsonMatch) return ruleParams;
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

      // Parse any structured toolCalls returned by the LLM
      if (Array.isArray(parsed.toolCalls)) {
        const parsedActions: ProposedToolCall[] = [];
        for (const rawTool of parsed.toolCalls.slice(0, MAX_TOOLS_PER_TURN)) {
          if (typeof rawTool !== 'object' || rawTool === null) continue;
          const tObj = rawTool as Record<string, unknown>;
          const toolParse = AgentToolTypeSchema.safeParse(tObj.tool);
          if (!toolParse.success) continue;
          const intentParse = WhatsAppIntentSchema.safeParse(tObj.intent);
          const kosIndices = Array.isArray(tObj.kosIndices)
            ? tObj.kosIndices.filter((n): n is number => typeof n === 'number' && n >= 1 && n <= 20)
            : undefined;
          parsedActions.push({
            tool: toolParse.data,
            intent: intentParse.success ? intentParse.data : undefined,
            kosIndices,
          });
        }
        this.lastParsedActions = parsedActions;
      }

      const candidate: Record<string, unknown> = { ...ruleParams };
      const oosItems: string[] = [...(ruleParams.unsupportedRequests ?? [])];

      // Stage 2: Deterministic Schema Validation & Gatekeeping
      // 1. Destination validation against 11 catalog destinations
      const rawDest = typeof parsed.destination === 'string' && parsed.destination.trim().length > 0 ? parsed.destination.trim() : null;
      if (rawDest) {
        const destLower = rawDest.toLowerCase();
        const matched = destinations.find((d) => {
          const id = d.id.toLowerCase();
          const name = d.nama.toLowerCase();
          return id === destLower || name.includes(destLower) || d.aliases.some((a) => a.toLowerCase() === destLower || destLower.includes(a.toLowerCase()));
        });
        if (matched) {
          candidate.destinationId = matched.id;
        } else {
          const destAreas = extractAreaKeywords(rawDest);
          if (destAreas.length > 0 && !isExplicitUnsupportedDestination(rawDest)) {
            const existingAreas = Array.isArray(candidate.areaKeywords)
              ? (candidate.areaKeywords as string[])
              : [];
            candidate.areaKeywords = Array.from(new Set([...destAreas, ...existingAreas]));
            delete candidate.destinationId;
          } else {
            // Destination is not in standard 11 catalog and not a Jabodetabek area -> Out-of-Scope Destination!
            const label = rawDest.length <= 4 ? rawDest.toUpperCase() : toTitleCase(rawDest);
            const fullLabel =
              label.startsWith('Kampus ') || label.startsWith('Stasiun ') || label.startsWith('Titik ')
                ? label
                : `Kampus/Titik ${label}`;
            if (!oosItems.includes(fullLabel)) oosItems.push(fullLabel);
            delete candidate.destinationId;
          }
        }
      }

      // 2. Budget validation: AI extraction takes precedence over fallback regex
      if (typeof parsed.minBudgetMonthly === 'number' && parsed.minBudgetMonthly > 0) {
        candidate.minBudgetMonthly = parsed.minBudgetMonthly;
      }
      if (typeof parsed.maxBudgetMonthly === 'number' && parsed.maxBudgetMonthly > 0) {
        candidate.maxBudgetMonthly = parsed.maxBudgetMonthly;
      }

      // 3. Commute validation
      if (typeof parsed.maxCommuteMin === 'number' && parsed.maxCommuteMin > 0) {
        candidate.maxCommuteMin = parsed.maxCommuteMin;
      }
      if (typeof parsed.maxCommuteCostRp === 'number' && parsed.maxCommuteCostRp > 0) {
        candidate.maxCommuteCostRp = parsed.maxCommuteCostRp;
      }
      if (
        parsed.preferredMode === 'ojek' ||
        parsed.preferredMode === 'transit' ||
        parsed.preferredMode === 'jalan_kaki'
      ) {
        candidate.preferredMode = parsed.preferredMode;
      }

      // 4. Type / Gender validation
      if (parsed.tipe === 'putra' || parsed.tipe === 'putri' || parsed.tipe === 'campur') {
        candidate.tipe = parsed.tipe;
      }

      // 5. Facilities validation: Strictly cross-check against STANDARD_FACILITY_MAP
      const rawFacs = Array.isArray(parsed.rawFacilities)
        ? (parsed.rawFacilities as unknown[]).filter((f): f is string => typeof f === 'string')
        : Array.isArray(parsed.fasilitas)
          ? (parsed.fasilitas as unknown[]).filter((f): f is string => typeof f === 'string')
          : [];

      const validFacilities: string[] = [];
      for (const item of rawFacs) {
        const clean = item.trim().toLowerCase();
        if (STANDARD_FACILITY_MAP[clean]) {
          validFacilities.push(STANDARD_FACILITY_MAP[clean]);
        } else {
          // Compound facility or non-standard facility -> Isolate into unsupportedRequests!
          const label = toTitleCase(item.trim());
          if (!oosItems.includes(label)) oosItems.push(label);
        }
      }
      const mergedFacs = Array.from(new Set([...(ruleParams.fasilitas ?? []), ...validFacilities]));
      if (mergedFacs.length > 0) {
        candidate.fasilitas = mergedFacs;
      } else {
        delete candidate.fasilitas;
      }

      // 6. Area keywords validation
      if (typeof parsed.area === 'string' && parsed.area.trim().length > 0) {
        const rawArea = parsed.area.trim();
        const mappedAreas = extractAreaKeywords(rawArea);
        const existingAreas = Array.isArray(candidate.areaKeywords)
          ? (candidate.areaKeywords as string[])
          : [];
        const toAdd = mappedAreas.length > 0 ? mappedAreas : [toTitleCase(rawArea)];
        candidate.areaKeywords = Array.from(new Set([...toAdd, ...existingAreas]));
      }

      if (typeof parsed.listrikTermasuk === 'boolean') {
        candidate.listrikTermasuk = parsed.listrikTermasuk;
      }

      if (oosItems.length > 0) {
        candidate.unsupportedRequests = oosItems;
      }

      const validated = ChatParamsSchema.safeParse(candidate);
      if (validated.success) {
        this.setBoundedCache(this.extractCache, normalizedKey, validated.data);
        return validated.data;
      }
      return ruleParams;
    } catch {
      return ruleParams;
    }
  }

  async detectToolCalls(message: string, context: ToolDetectionContext): Promise<ProposedToolCall[]> {
    const ruleTools = await this.fallback.detectToolCalls(message, context);
    if (this.lastParsedActions.length === 0) {
      return ruleTools;
    }

    const candidateKos = context.results.length > 0 ? context.results.map((r) => r.kos) : context.allKos;
    const merged: ProposedToolCall[] = [...ruleTools];

    for (const llmAction of this.lastParsedActions) {
      if (merged.some((m) => m.tool === llmAction.tool)) continue;
      const targetIds = (llmAction.kosIndices ?? [1])
        .map((idx) => candidateKos[idx - 1]?.id)
        .filter((id): id is string => typeof id === 'string');

      merged.push({
        tool: llmAction.tool,
        intent: llmAction.intent,
        kosIds: targetIds.length > 0 ? targetIds : candidateKos.slice(0, 2).map((k) => k.id),
        kosIndices: llmAction.kosIndices,
        destinationId: context.params.destinationId,
      });
    }

    return merged.slice(0, MAX_TOOLS_PER_TURN);
  }

  /**
   * Token-optimized RAG context formatter:
   * - Sends only top 3 kos (instead of all 5) since UI cards already display the full list
   * - Prioritizes requested facilities and caps at 4 facilities per kos
   */
  private formatRetrievedContext(results: ChatbotResultItem[], requestedFacilities?: string[]): string {
    const reqLower = (requestedFacilities ?? []).map((f) => f.toLowerCase());
    return results
      .slice(0, RAG_MAX_CONTEXT_ITEMS)
      .map((item, idx) => {
        const { kos } = item;
        const prioritized = [...kos.fasilitas].sort((a, b) => {
          const aMatch = reqLower.some((r) => a.toLowerCase().includes(r)) ? -1 : 0;
          const bMatch = reqLower.some((r) => b.toLowerCase().includes(r)) ? -1 : 0;
          return aMatch - bMatch;
        });
        const topFacilities = prioritized.slice(0, RAG_MAX_FACILITIES_PER_KOS).join(', ') || '-';
        return `${idx + 1}. ${kos.namaKos} (${kos.area}, ${kos.tipe}, ${formatRp(kos.hargaSewa)}/bln, Fasilitas: ${topFacilities})`;
      })
      .join('\n');
  }

  private buildReplyCacheKey(params: ChatParams, context?: RagContext): string {
    const ids = (context?.results ?? [])
      .slice(0, RAG_MAX_CONTEXT_ITEMS)
      .map((r) => r.kos.id)
      .join(',');
    return JSON.stringify({
      d: params.destinationId ?? '',
      a: params.areaKeywords?.slice(0, 2) ?? [],
      minB: params.minBudgetMonthly ?? 0,
      maxB: params.maxBudgetMonthly ?? 0,
      t: params.tipe ?? '',
      f: params.fasilitas ?? [],
      fb: Boolean(context?.isFallback),
      oos: context?.unsupportedRequests ?? [],
      ids,
    });
  }

  async composeReply(params: ChatParams, resultCount: number, context?: RagContext): Promise<string> {
    if (
      !params.destinationId &&
      !params.maxBudgetMonthly &&
      !params.minBudgetMonthly &&
      (!params.fasilitas || params.fasilitas.length === 0) &&
      (!params.areaKeywords || params.areaKeywords.length === 0) &&
      (!params.unsupportedRequests || params.unsupportedRequests.length === 0)
    ) {
      return this.fallback.composeReply(params, resultCount, context);
    }
    if (resultCount === 0 || !context?.results || context.results.length === 0) {
      return this.fallback.composeReply(params, resultCount, context);
    }

    const cacheKey = this.buildReplyCacheKey(params, context);
    const cachedReply = this.replyCache.get(cacheKey);
    if (cachedReply) {
      this.lastAiMode = 'gemini';
      return cachedReply;
    }

    const ragDocs = this.formatRetrievedContext(context.results, params.fasilitas);
    const systemPromptLines = [
      'Kamu KosMatch AI, asisten pencari kos Jakarta yang ramah ("Halo Kak!"). Tanpa tanda bintang markdown (** atau *).',
      'Tulis 2 paragraf singkat (pisahkan 1 baris kosong):',
      'Paragraf 1: Sebutkan 1-2 kos terbaik dari DATA KOS (nama, harga, area, fasilitas). Jangan mengarang data.',
      'Paragraf 2: Ajak klik "Lihat Estimasi Transportasi" untuk melihat Estimasi waktu/ongkos perjalanan, lalu tanyakan preferensi lanjutan (tipe putra/putri/campur, fasilitas, atau fitur bandingkan kos & draf chat pemilik).',
    ];

    if (context?.isFallback) {
      systemPromptLines.push(
        'Catatan Fallback: Kriteria asli belum terpenuhi persis; jelaskan singkat dan tawarkan DATA KOS sebagai alternatif terdekat.',
      );
    }

    if (context?.unsupportedRequests && context.unsupportedRequests.length > 0) {
      systemPromptLines.push(
        `Catatan Out-of-Scope: Sampaikan sopan bahwa (${context.unsupportedRequests.join(', ')}) tidak tersedia di database.`,
      );
    }

    const systemPrompt = systemPromptLines.join('\n');

    const userPrompt = [
      `Query: "${context.message ?? 'Rekomendasi kos'}" (${resultCount} kos)`,
      'DATA KOS:',
      ragDocs,
    ].join('\n');

    const generated = await this.chatCompletion(systemPrompt, userPrompt, 0.3, 200);
    if (!generated) {
      return this.fallback.composeReply(params, resultCount, context);
    }
    this.lastAiMode = 'gemini';

    const finalReply = !/estimasi/i.test(generated)
      ? `${generated} Klik tombol "Lihat Estimasi Transportasi" pada kartu kos untuk melihat Estimasi rute perjalanan.`
      : generated;

    this.setBoundedCache(this.replyCache, cacheKey, finalReply);
    return finalReply;
  }
}
