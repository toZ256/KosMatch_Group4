'use strict';

// Entry point for Vercel Serverless Functions (/api/*).
// Pre-bundled during `pnpm build:vercel` into apps/api/dist/vercel-bundle.cjs.
const bundle = require('../apps/api/dist/vercel-bundle.cjs');

module.exports = bundle.default || bundle;
