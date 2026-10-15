import type { CommuteProvider } from './CommuteProvider';
import { MockCommuteProvider } from './MockCommuteProvider';

/** Selects the CommuteProvider implementation from USE_MOCK_AI. */
export function createCommuteProvider(useMockAi: boolean): CommuteProvider {
  if (!useMockAi) throw new Error('Provider belum diimplementasikan');
  return new MockCommuteProvider();
}

export type { CommuteProvider } from './CommuteProvider';
