import type { ChatbotResultItem, ChatParams, Destination } from '@kosmatch/shared';

export interface RagContext {
  message?: string;
  results?: ChatbotResultItem[];
  destination?: Destination | null;
}

/** Turns natural language into search params and composes replies. Services depend on this only. */
export interface LlmProvider {
  extractParams(message: string, destinations: Destination[]): Promise<ChatParams>;
  composeReply(params: ChatParams, resultCount: number, context?: RagContext): Promise<string>;
}
