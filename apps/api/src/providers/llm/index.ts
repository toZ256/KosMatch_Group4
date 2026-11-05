import type { LlmProvider } from './LlmProvider';
import { MockLlmProvider } from './MockLlmProvider';
import { RagLlmProvider, type RagLlmOptions } from './RagLlmProvider';

/** Selects the LlmProvider implementation from USE_MOCK_AI or LLM_PROVIDER. */
export function createLlmProvider(modeOrMock: boolean | string, options?: RagLlmOptions): LlmProvider {
  if (modeOrMock === true || modeOrMock === 'mock') {
    return new MockLlmProvider();
  }
  if (
    modeOrMock === false ||
    modeOrMock === 'gemini' ||
    modeOrMock === 'rag' ||
    modeOrMock === 'router' ||
    modeOrMock === '9router'
  ) {
    return new RagLlmProvider(options);
  }
  throw new Error('Provider belum diimplementasikan');
}

export type { LlmProvider, RagContext } from './LlmProvider';
export { RagLlmProvider, type RagLlmOptions } from './RagLlmProvider';
