import fs from 'node:fs';
import path from 'node:path';
import { ChatParamsSchema, type ChatbotResultItem, type ChatParams, type Destination } from '@kosmatch/shared';
import type { LlmProvider, RagContext } from './LlmProvider';
import { MockLlmProvider } from './MockLlmProvider';

const formatRp = (n: number) => `Rp${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

const GOOGLE_AI_STUDIO_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';
const VERTEX_EXPRESS_BASE_URL = 'https://aiplatform.googleapis.com/v1/publishers/google';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

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

const GREETING_ONLY = /^(halo|hai|hi|hello|pagi|siang|sore|malam|permisi|tes|test|ping|p)\b[!.?\s]*$/i;

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
 * RAG (Retrieval-Augmented Generation) LLM Provider.
 * Translates natural/casual human prompts into structured database filters,
 * and composes grounded recommendations without wasting tokens on transport tables.
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

  constructor(options: RagLlmOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.LLM_BASE_URL ?? GOOGLE_AI_STUDIO_BASE_URL).replace(/\/+$/, '');
    this.initialApiKey = options.apiKey ?? '';
    this.configuredModel = options.model ?? process.env.LLM_MODEL ?? DEFAULT_GEMINI_MODEL;
    this.timeoutMs = options.timeoutMs ?? 4500;
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

  /** Calls Google AI Studio or Vertex AI Express native generateContent REST API with fast failover. */
  private async callGeminiNative(systemPrompt: string, userPrompt: string, temperature = 0.2): Promise<string | null> {
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
            },
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
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

  private async chatCompletion(systemPrompt: string, userPrompt: string, temperature = 0.2): Promise<string | null> {
    if (this.isGoogleEndpoint()) {
      return this.callGeminiNative(systemPrompt, userPrompt, temperature);
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
    const ruleParams = await this.fallback.extractParams(message, destinations);
    const trimmed = message.trim();
    if (trimmed.length < 4 || GREETING_ONLY.test(trimmed)) {
      return ruleParams;
    }

    const destCatalog = destinations
      .map((d) => `- id: "${d.id}" | nama: "${d.nama}" | kategori: ${d.kategori} | alias: [${d.aliases.join(', ')}]`)
      .join('\n');

    const systemPrompt = [
      'Kamu adalah AI Query Planner & Filter Extractor untuk database pencarian kos KosMatch Jakarta.',
      'Pengguna bisa berbicara dengan bahasa sehari-hari/gaul/bebas ("asal ngomong"). Tugasmu adalah memahami maksud mereka dan menerjemahkannya menjadi filter JSON yang presisi untuk query database PostgreSQL.',
      '',
      'Daftar destinasi kampus/kantor/stasiun di database:',
      destCatalog,
      '',
      'Daftar nama fasilitas standar di database (terjemahkan bahasa pengguna ke istilah ini):',
      '- "Kamar Mandi Dalam" (jika user minta km dalam/dalem, wc sendiri, tidak mau antri mandi luar, privasi mandi)',
      '- "AC" (jika user minta ac, dingin, anti gerah/panas)',
      '- "WiFi" (jika user minta wifi, internet kenceng, buat wfh/zoom/kuliah online)',
      '- "Kasur" (jika user minta sudah ada kasur/tempat tidur/full furnished)',
      '- "Lemari" (jika user minta lemari baju)',
      '- "Meja" (jika user minta meja belajar/kerja)',
      '- "Dapur" (jika user minta bisa masak/dapur)',
      '- "Parkir" (jika user bawa motor/mobil/butuh parkiran)',
      '- "Kulkas", "TV", "Laundry", "CCTV", "Kloset Duduk", "Shower", "Air panas"',
      '',
      'Kembalikan HANYA objek JSON murni (tanpa markdown) dengan skema berikut (isi hanya yang relevan):',
      '{',
      '  "destinationId": string (id dari daftar destinasi di atas jika relevan),',
      '  "minBudgetMonthly": number (batas bawah harga sewa per bulan dalam Rupiah, misal 1000000),',
      '  "maxBudgetMonthly": number (batas atas harga sewa per bulan dalam Rupiah, misal 2000000),',
      '  "maxCommuteMin": number (maksimal waktu perjalanan dalam menit),',
      '  "maxCommuteCostRp": number (maksimal ongkos transportasi sekali jalan dalam Rupiah),',
      '  "preferredMode": "ojek" | "transit" | "jalan_kaki",',
      '  "tipe": "putra" | "putri" | "campur",',
      '  "fasilitas": string[] (daftar fasilitas standar yang diminta/tersirat oleh user),',
      '  "areaKeywords": string[] (nama daerah/kecamatan/kota yang disebut atau dekat tujuan, misal ["Depok", "Beji"] untuk UI),',
      '  "listrikTermasuk": boolean (true jika user minta harga sudah termasuk listrik / free listrik)',
      '}',
    ].join('\n');

    const raw = await this.chatCompletion(systemPrompt, trimmed, 0);
    if (!raw) return ruleParams;

    try {
      const jsonMatch = /\{[\s\S]*\}/.exec(raw);
      if (!jsonMatch) return ruleParams;
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const validDestIds = new Set(destinations.map((d) => d.id));

      const candidate: Record<string, unknown> = { ...ruleParams };
      if (typeof parsed.destinationId === 'string' && validDestIds.has(parsed.destinationId)) {
        candidate.destinationId = parsed.destinationId;
      }
      if (typeof parsed.minBudgetMonthly === 'number' && parsed.minBudgetMonthly > 0) {
        candidate.minBudgetMonthly = ruleParams.minBudgetMonthly ?? parsed.minBudgetMonthly;
      }
      if (typeof parsed.maxBudgetMonthly === 'number' && parsed.maxBudgetMonthly > 0) {
        candidate.maxBudgetMonthly = ruleParams.maxBudgetMonthly ?? parsed.maxBudgetMonthly;
      }
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
      if (parsed.tipe === 'putra' || parsed.tipe === 'putri' || parsed.tipe === 'campur') {
        candidate.tipe = parsed.tipe;
      }
      if (Array.isArray(parsed.fasilitas)) {
        const llmFacilities = parsed.fasilitas.filter((f): f is string => typeof f === 'string' && f.trim().length > 0);
        const merged = Array.from(new Set([...(ruleParams.fasilitas ?? []), ...llmFacilities]));
        if (merged.length > 0) candidate.fasilitas = merged;
      }
      if (Array.isArray(parsed.areaKeywords)) {
        const areas = parsed.areaKeywords.filter((a): a is string => typeof a === 'string' && a.trim().length > 0);
        if (areas.length > 0) candidate.areaKeywords = areas;
      }
      if (typeof parsed.listrikTermasuk === 'boolean') {
        candidate.listrikTermasuk = parsed.listrikTermasuk;
      }

      const validated = ChatParamsSchema.safeParse(candidate);
      return validated.success ? validated.data : ruleParams;
    } catch {
      return ruleParams;
    }
  }

  /** Compact context formatter — omits commute tables to save LLM tokens. */
  private formatRetrievedContext(results: ChatbotResultItem[]): string {
    return results
      .map((item, idx) => {
        const { kos } = item;
        const topFacilities = kos.fasilitas.slice(0, 8).join(', ') || '-';
        return `${idx + 1}. ${kos.namaKos} | Area: ${kos.area} | Tipe: ${kos.tipe} | Harga: ${formatRp(kos.hargaSewa)}/bln | Fasilitas: ${topFacilities}`;
      })
      .join('\n');
  }

  async composeReply(params: ChatParams, resultCount: number, context?: RagContext): Promise<string> {
    if (
      !params.destinationId &&
      !params.maxBudgetMonthly &&
      !params.minBudgetMonthly &&
      (!params.fasilitas || params.fasilitas.length === 0) &&
      (!params.areaKeywords || params.areaKeywords.length === 0)
    ) {
      return this.fallback.composeReply(params, resultCount, context);
    }
    if (resultCount === 0 || !context?.results || context.results.length === 0) {
      return this.fallback.composeReply(params, resultCount, context);
    }

    const ragDocs = this.formatRetrievedContext(context.results);
    const systemPrompt = [
      'Kamu adalah Asisten AI KosMatch Jakarta. Jawab singkat (maksimal 2-3 kalimat), ramah, dalam Bahasa Indonesia.',
      'Sebutkan 1-2 kos terbaik dari DATA KOS di bawah beserta harga dan fasilitas utamanya yang cocok dengan permintaan pengguna.',
      'Jangan mengarang data di luar daftar. Beritahu pengguna bahwa mereka bisa menekan tombol "Lihat Estimasi Transportasi" pada kartu kos untuk mengecek Estimasi waktu dan ongkos perjalanan.',
    ].join('\n');

    const userPrompt = [
      `Permintaan: "${context.message ?? 'Rekomendasi kos'}"`,
      `Ditemukan: ${resultCount} kos`,
      'DATA KOS:',
      ragDocs,
    ].join('\n');

    const generated = await this.chatCompletion(systemPrompt, userPrompt, 0.3);
    if (!generated) {
      return this.fallback.composeReply(params, resultCount, context);
    }

    if (!/estimasi/i.test(generated)) {
      return `${generated} Klik tombol "Lihat Estimasi Transportasi" pada kartu kos untuk melihat Estimasi rute perjalanan.`;
    }
    return generated;
  }
}
