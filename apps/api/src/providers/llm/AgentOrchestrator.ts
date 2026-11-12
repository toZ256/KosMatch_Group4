import {
  AgentActionSchema,
  ApplySearchFiltersSchema,
  BookmarkActionSchema,
  ChatParamsSchema,
  CompareKosSchema,
  GUARDRAIL_INJECTION_REPLY,
  GUARDRAIL_OUT_OF_SCOPE_REPLY,
  GUARDRAIL_TOXIC_REPLY,
  MAX_TOOLS_PER_TURN,
  WhatsAppDraftSchema,
  detectPromptInjection,
  detectToxicOrSara,
  enforceEstimateLabel,
  isOutOfScope,
  sanitizeOutputText,
  sanitizePII,
  validateGroundedResults,
  type AgentAction,
  type ChatbotResponse,
  type ChatbotResultItem,
  type ChatParams,
  type Destination,
  type Kos,
  type WhatsAppIntent,
} from '@kosmatch/shared';
import type { Repository } from '../../data/repository';
import type { CommuteProvider } from '../commute';
import type { LlmProvider, ProposedToolCall, RagContext, ToolDetectionContext } from './LlmProvider';
import { MockLlmProvider } from './MockLlmProvider';

const formatRp = (n: number) => `Rp${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export interface AgentAskOptions {
  userId?: string;
}

/**
 * Generates a deterministic, sanitized demo WhatsApp number per kos so no real personal phone numbers are exposed.
 */
export function deriveSafeOwnerWhatsAppNumber(kos: Kos): string {
  let hash = 0;
  for (let i = 0; i < kos.id.length; i++) {
    hash = (hash * 31 + kos.id.charCodeAt(i)) % 9000;
  }
  const suffix = String(1000 + Math.abs(hash)).padStart(4, '0');
  return `628120000${suffix}`;
}

/**
 * Formats a polite Bahasa Indonesia WhatsApp draft message according to the user's intent.
 */
export function buildWhatsAppDraftMessage(kos: Kos, intent: WhatsAppIntent): string {
  switch (intent) {
    case 'jadwal_survei':
      return `Halo Bapak/Ibu Pemilik ${kos.namaKos}, saya menemukan kos Anda melalui KosMatch Jakarta. Saya tertarik dengan kamar tipe ${kos.tipe} dan ingin menanyakan apakah saya bisa menjadwalkan survei lokasi dalam waktu dekat? Terima kasih.`;
    case 'negosiasi_harga':
      return `Halo Bapak/Ibu Pemilik ${kos.namaKos}, saya menemukan kos Anda melalui KosMatch Jakarta. Saya tertarik dengan kamar tipe ${kos.tipe} (${formatRp(kos.hargaSewa)}/bulan) dan ingin menanyakan apakah ada penawaran khusus untuk sewa jangka panjang? Terima kasih.`;
    case 'tanya_fasilitas':
      return `Halo Bapak/Ibu Pemilik ${kos.namaKos}, saya menemukan kos Anda melalui KosMatch Jakarta. Saya tertarik dengan kamar tipe ${kos.tipe} dan ingin menanyakan detail lebih lanjut mengenai fasilitas serta peraturan kos. Terima kasih.`;
    case 'tanya_ketersediaan':
    default:
      return `Halo Bapak/Ibu Pemilik ${kos.namaKos}, saya menemukan kos Anda melalui KosMatch Jakarta. Saya tertarik dan ingin menanyakan apakah kamar tipe ${kos.tipe} masih tersedia untuk periode sewa bulan depan? Terima kasih.`;
  }
}

/**
 * Builds the `/cari?...` URL query string from extracted search parameters.
 */
export function buildSearchFilterUrl(params: ChatParams): string {
  const sp = new URLSearchParams();
  if (params.destinationId) sp.set('destinationId', params.destinationId);
  if (params.maxBudgetMonthly) sp.set('maxPrice', String(params.maxBudgetMonthly));
  if (params.tipe) sp.set('tipe', params.tipe);
  if (params.areaKeywords && params.areaKeywords.length > 0) {
    sp.set('q', params.areaKeywords[0]!);
  } else if (params.fasilitas && params.fasilitas.length > 0) {
    sp.set('q', params.fasilitas[0]!);
  }
  const qs = sp.toString();
  return qs ? `/cari?${qs}` : '/cari';
}

/**
 * 4-Layer AI Guardrails & Agentic Tool Orchestrator.
 * - Layer 1: Input Guardrails (Prompt Injection, Out-of-Scope Domain Firewall, PII Redaction, Toxic Filter)
 * - Layer 2: Action & Auth Guardrails (HITL, Strict Zod Schema Validation, Max 3 Tools/Turn, Guest vs Tenant Auth)
 * - Layer 3: Output & Grounding Guardrails (Entity Grounding against DB, Mandatory 'Estimasi' Label, Output Moderation)
 * - Layer 4: Fallback & Circuit Breaker (Resilient fallback to MockLlmProvider on timeout/error)
 */
export class AgentOrchestrator {
  private readonly fallbackLlm = new MockLlmProvider();

  constructor(
    private readonly repo: Repository,
    private readonly llm: LlmProvider,
    private readonly commute: CommuteProvider,
  ) {}

  /**
   * Layer 1: Evaluates input guardrails before touching the LLM or Database.
   */
  runInputGuardrails(rawMessage: string): {
    blockedResponse?: ChatbotResponse;
    sanitizedMessage: string;
    piiRedacted: boolean;
  } {
    const sanitizedMessage = sanitizePII(rawMessage);
    const piiRedacted = sanitizedMessage !== rawMessage;

    if (detectPromptInjection(rawMessage)) {
      return {
        sanitizedMessage,
        piiRedacted,
        blockedResponse: {
          reply: GUARDRAIL_INJECTION_REPLY,
          params: {},
          results: [],
          noResults: false,
          actions: [],
          guardrailBlocked: true,
          guardrailReason: 'INJECTION_ATTEMPT_DETECTED',
          guardrailNotice:
            'Permintaan ditolak oleh sistem keamanan (Input Guardrail: Terdeteksi upaya Prompt Injection / Jailbreak).',
          sanitizedMessage: piiRedacted ? sanitizedMessage : undefined,
        },
      };
    }

    if (detectToxicOrSara(rawMessage)) {
      return {
        sanitizedMessage,
        piiRedacted,
        blockedResponse: {
          reply: GUARDRAIL_TOXIC_REPLY,
          params: {},
          results: [],
          noResults: false,
          actions: [],
          guardrailBlocked: true,
          guardrailReason: 'TOXIC_CONTENT',
          guardrailNotice: 'Permintaan ditolak oleh Guardrail Moderasi Konten & Non-Diskriminasi.',
          sanitizedMessage: piiRedacted ? sanitizedMessage : undefined,
        },
      };
    }

    if (isOutOfScope(rawMessage)) {
      return {
        sanitizedMessage,
        piiRedacted,
        blockedResponse: {
          reply: GUARDRAIL_OUT_OF_SCOPE_REPLY,
          params: {},
          results: [],
          noResults: false,
          actions: [],
          guardrailBlocked: true,
          guardrailReason: 'OUT_OF_SCOPE_DOMAIN',
          guardrailNotice: 'Topik berada di luar cakupan layanan pencarian kos & komuter KosMatch Jakarta.',
          sanitizedMessage: piiRedacted ? sanitizedMessage : undefined,
        },
      };
    }

    return { sanitizedMessage, piiRedacted };
  }

  /**
   * Layer 4 Circuit Breaker wrapper for parameter extraction.
   */
  async safeExtractParams(message: string, destinations: Destination[]): Promise<ChatParams> {
    try {
      const raw = await this.llm.extractParams(message, destinations);
      return ChatParamsSchema.parse(raw);
    } catch {
      const fallbackRaw = await this.fallbackLlm.extractParams(message, destinations);
      return ChatParamsSchema.parse(fallbackRaw);
    }
  }

  /**
   * Layer 4 Circuit Breaker wrapper for tool detection.
   */
  async safeDetectToolCalls(message: string, context: ToolDetectionContext): Promise<ProposedToolCall[]> {
    try {
      if (this.llm.detectToolCalls) {
        return await this.llm.detectToolCalls(message, context);
      }
      return await this.fallbackLlm.detectToolCalls(message, context);
    } catch {
      return await this.fallbackLlm.detectToolCalls(message, context);
    }
  }

  /**
   * Layer 4 Circuit Breaker wrapper for reply composition.
   */
  async safeComposeReply(params: ChatParams, resultCount: number, context?: RagContext): Promise<string> {
    try {
      return await this.llm.composeReply(params, resultCount, context);
    } catch {
      return await this.fallbackLlm.composeReply(params, resultCount, context);
    }
  }

  /**
   * Layer 2: Validates and executes/proposes up to MAX_TOOLS_PER_TURN (3) tools with strict Zod & Auth guardrails.
   */
  async executeTools(
    proposedCalls: ProposedToolCall[],
    context: {
      validKosMap: Map<string, Kos>;
      results: ChatbotResultItem[];
      allKos: Kos[];
      destinations: Destination[];
      params: ChatParams;
      userId?: string;
    },
  ): Promise<{ actions: AgentAction[]; toolReplyNotes: string[] }> {
    const actions: AgentAction[] = [];
    const toolReplyNotes: string[] = [];

    // Rate Limiting & Anti-Loop: strictly cap at MAX_TOOLS_PER_TURN (3)
    const boundedCalls = proposedCalls.slice(0, MAX_TOOLS_PER_TURN);

    for (const call of boundedCalls) {
      if (call.tool === 'whatsapp_draft') {
        const targetId = call.kosIds?.[0] ?? context.results[0]?.kos.id ?? context.allKos[0]?.id;
        const kos = targetId ? context.validKosMap.get(targetId) : undefined;
        if (!kos) continue;

        const intent: WhatsAppIntent = call.intent ?? 'tanya_ketersediaan';
        const ownerPhone = deriveSafeOwnerWhatsAppNumber(kos);
        const draftMessage = buildWhatsAppDraftMessage(kos, intent);
        const waUrl = `https://wa.me/${ownerPhone}?text=${encodeURIComponent(draftMessage)}`;
        const inAppChatUrl = `/chat/${kos.ownerId}?draft=${encodeURIComponent(draftMessage)}`;

        const parsedPayload = WhatsAppDraftSchema.safeParse({
          kosId: kos.id,
          ownerId: kos.ownerId,
          kosName: kos.namaKos,
          tipe: kos.tipe,
          hargaSewa: kos.hargaSewa,
          area: kos.area,
          ownerPhone,
          intent,
          draftMessage,
          waUrl,
          inAppChatUrl,
        });
        if (!parsedPayload.success) continue;

        const candidateAction: AgentAction = {
          type: 'whatsapp_draft',
          payload: parsedPayload.data,
          // HITL (Human-in-the-Loop): chat/WhatsApp action is always 'proposed' and requires explicit user click
          status: 'proposed',
          label: `Hubungi Pemilik ${kos.namaKos} (Chat Aplikasi / WhatsApp)`,
        };
        const validatedAction = AgentActionSchema.safeParse(candidateAction);
        if (validatedAction.success) {
          actions.push(validatedAction.data);
          toolReplyNotes.push(
            `Saya telah menyiapkan draf pesan untuk pemilik ${kos.namaKos}. Silakan pilih tombol Chat di Aplikasi atau Buka Chat WhatsApp di bawah untuk mengirimkannya.`,
          );
        }
      } else if (call.tool === 'bookmark_kos') {
        const rawIds = call.kosIds ?? [];
        const groundedKosList = rawIds
          .map((id) => context.validKosMap.get(id))
          .filter((k): k is Kos => k !== undefined);
        if (groundedKosList.length === 0) continue;

        const groundedIds = groundedKosList.map((k) => k.id);
        const kosNames = groundedKosList.map((k) => k.namaKos).join(', ');
        const isAuthenticated = Boolean(context.userId && context.userId.trim().length > 0);

        const parsedPayload = BookmarkActionSchema.safeParse({
          kosIds: groundedIds,
          kosItems: groundedKosList,
          requiresAuth: !isAuthenticated,
        });
        if (!parsedPayload.success) continue;

        if (isAuthenticated && context.userId) {
          for (const kId of groundedIds) {
            await this.repo.bookmarks.add(context.userId, kId);
          }
          const candidateAction: AgentAction = {
            type: 'bookmark_kos',
            payload: parsedPayload.data,
            status: 'executed',
            label: `Berhasil menyimpan ${kosNames} ke daftar tersimpan Anda`,
          };
          const validatedAction = AgentActionSchema.safeParse(candidateAction);
          if (validatedAction.success) {
            actions.push(validatedAction.data);
            toolReplyNotes.push(`Berhasil menyimpan ${kosNames} ke daftar tersimpan Anda.`);
          }
        } else {
          const candidateAction: AgentAction = {
            type: 'bookmark_kos',
            payload: parsedPayload.data,
            status: 'proposed',
            label: 'Silakan masuk terlebih dahulu untuk menyimpan kos ini',
          };
          const validatedAction = AgentActionSchema.safeParse(candidateAction);
          if (validatedAction.success) {
            actions.push(validatedAction.data);
            toolReplyNotes.push(`Silakan masuk terlebih dahulu untuk menyimpan ${kosNames} ke daftar tersimpan Anda.`);
          }
        }
      } else if (call.tool === 'compare_kos') {
        const rawIds = call.kosIds ?? [];
        let groundedKosList = rawIds
          .map((id) => context.validKosMap.get(id))
          .filter((k): k is Kos => k !== undefined);

        if (groundedKosList.length < 2) {
          const fallbackPool = context.results.length >= 2 ? context.results.map((r) => r.kos) : context.allKos;
          for (const k of fallbackPool) {
            if (groundedKosList.length >= 2) break;
            if (!groundedKosList.some((existing) => existing.id === k.id)) {
              groundedKosList.push(k);
            }
          }
        }
        groundedKosList = groundedKosList.slice(0, 3);
        if (groundedKosList.length < 2) continue;

        const destId = call.destinationId ?? context.params.destinationId ?? context.destinations[0]?.id;
        const dest = destId ? context.destinations.find((d) => d.id === destId) ?? null : null;

        const comparedItems: ChatbotResultItem[] = await Promise.all(
          groundedKosList.map(async (kos) => {
            const existingResult = context.results.find((r) => r.kos.id === kos.id);
            if (existingResult && existingResult.commute.length > 0) {
              return existingResult;
            }
            const commute = dest ? await this.commute.estimate(kos, dest) : [];
            return {
              kos,
              commute: commute.map((c) => ({ ...c, isEstimate: true as const, source: 'mock' as const })),
            };
          }),
        );

        const parsedPayload = CompareKosSchema.safeParse({
          kosIds: groundedKosList.map((k) => k.id),
          destinationId: dest?.id,
          destinationName: dest?.nama,
          items: comparedItems,
        });
        if (!parsedPayload.success) continue;

        const comparedNames = groundedKosList.map((k) => k.namaKos).join(' vs ');
        const candidateAction: AgentAction = {
          type: 'compare_kos',
          payload: parsedPayload.data,
          status: 'executed',
          label: `Perbandingan Kos: ${comparedNames}`,
        };
        const validatedAction = AgentActionSchema.safeParse(candidateAction);
        if (validatedAction.success) {
          actions.push(validatedAction.data);
          toolReplyNotes.push(
            `Berikut tabel perbandingan antara ${groundedKosList.map((k) => k.namaKos).join(' dan ')} lengkap dengan harga sewa, fasilitas utama, dan Estimasi komuter.`,
          );
        }
      } else if (call.tool === 'search_redirect') {
        const searchUrl = buildSearchFilterUrl(context.params);
        const totalMatches = context.results.length;
        const parsedPayload = ApplySearchFiltersSchema.safeParse({
          destinationId: context.params.destinationId,
          maxBudget: context.params.maxBudgetMonthly,
          tipe: context.params.tipe,
          facilities: context.params.fasilitas,
          q: context.params.areaKeywords?.[0],
          searchUrl,
          totalMatches,
        });
        if (!parsedPayload.success) continue;

        const countLabel = totalMatches > 0 ? `${totalMatches} ` : '';
        const candidateAction: AgentAction = {
          type: 'search_redirect',
          payload: parsedPayload.data,
          status: 'proposed',
          label: `Lihat ${countLabel}Kos di Halaman Pencarian →`,
        };
        const validatedAction = AgentActionSchema.safeParse(candidateAction);
        if (validatedAction.success) {
          actions.push(validatedAction.data);
        }
      }
    }

    return { actions, toolReplyNotes };
  }

  getLastAiMode(): 'gemini' | 'mock' {
    return this.llm.getLastAiMode ? this.llm.getLastAiMode() : 'mock';
  }

  /**
   * Layer 3: Output & Grounding Guardrails.
   * Ensures every Kos ID is grounded in the database, commute has `isEstimate: true`,
   * output text is moderated, and the 'Estimasi' label is present when needed.
   */
  applyOutputGuardrails(
    response: ChatbotResponse,
    validKosMap: Map<string, Kos>,
  ): ChatbotResponse {
    const groundedResults = validateGroundedResults(response.results, validKosMap);
    const moderatedReply = sanitizeOutputText(response.reply);
    const finalReply = enforceEstimateLabel(moderatedReply, groundedResults.length > 0);

    return {
      ...response,
      reply: finalReply,
      results: groundedResults,
      aiMode: response.aiMode ?? this.getLastAiMode(),
    };
  }
}
