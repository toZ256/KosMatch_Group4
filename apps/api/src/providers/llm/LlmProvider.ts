import type {
  AgentToolType,
  ChatbotResultItem,
  ChatParams,
  Destination,
  Kos,
  WhatsAppIntent,
} from '@kosmatch/shared';

export interface RagContext {
  message?: string;
  results?: ChatbotResultItem[];
  destination?: Destination | null;
  isFallback?: boolean;
  fallbackReason?: string;
  unsupportedRequests?: string[];
}

export interface ProposedToolCall {
  tool: AgentToolType;
  kosIds?: string[];
  kosIndices?: number[];
  intent?: WhatsAppIntent;
  destinationId?: string;
}

export interface ToolDetectionContext {
  results: ChatbotResultItem[];
  allKos: Kos[];
  destinations: Destination[];
  params: ChatParams;
}

/** Turns natural language into search params, tool calls, and grounded replies. Services depend on this only. */
export interface LlmProvider {
  extractParams(message: string, destinations: Destination[]): Promise<ChatParams>;
  composeReply(params: ChatParams, resultCount: number, context?: RagContext): Promise<string>;
  detectToolCalls?(message: string, context: ToolDetectionContext): Promise<ProposedToolCall[]>;
  getLastAiMode?(): 'gemini' | 'mock';
}
