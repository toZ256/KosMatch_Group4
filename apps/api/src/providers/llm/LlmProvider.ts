import type { ChatParams, Destination } from '@kosmatch/shared';

/** Turns natural language into search params and composes replies. Services depend on this only. */
export interface LlmProvider {
  extractParams(message: string, destinations: Destination[]): Promise<ChatParams>;
  composeReply(params: ChatParams, resultCount: number): Promise<string>;
}
