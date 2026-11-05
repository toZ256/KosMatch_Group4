import type { CommuteProvider } from './CommuteProvider';
import { MockCommuteProvider } from './MockCommuteProvider';
import { OsrmCommuteProvider, type OsrmOptions } from './OsrmCommuteProvider';

/** Selects the CommuteProvider implementation from COMMUTE_PROVIDER or USE_MOCK_AI. */
export function createCommuteProvider(modeOrMock: boolean | string, options?: OsrmOptions): CommuteProvider {
  if (modeOrMock === true || modeOrMock === 'mock') {
    return new MockCommuteProvider();
  }
  if (modeOrMock === false || modeOrMock === 'osrm') {
    return new OsrmCommuteProvider(options);
  }
  throw new Error('Provider belum diimplementasikan');
}

export type { CommuteProvider } from './CommuteProvider';
export { OsrmCommuteProvider, type OsrmOptions } from './OsrmCommuteProvider';
