import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Pre-bundled during `pnpm build:vercel` into apps/api/dist/vercel-bundle.cjs.
const bundle = require('../apps/api/dist/vercel-bundle.cjs');

export default bundle.default || bundle;
