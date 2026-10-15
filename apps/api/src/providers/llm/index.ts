import type { LlmProvider } from './LlmProvider';
import { MockLlmProvider } from './MockLlmProvider';

/** Selects the LlmProvider implementation from USE_MOCK_AI. */
export function createLlmProvider(useMockAi: boolean): LlmProvider {
  if (!useMockAi) throw new Error('Provider belum diimplementasikan');
  return new MockLlmProvider();
}

export type { LlmProvider } from './LlmProvider';
