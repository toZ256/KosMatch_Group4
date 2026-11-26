import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { build } from 'esbuild';

function run(command, extraEnv = {}) {
  console.log(`[build:vercel] > ${command}`);
  execSync(command, {
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });
}

async function main() {
  // 1. Generate Prisma Client (including rhel-openssl-3.0.x engine for Vercel)
  run('pnpm exec prisma generate');

  // 2. Build frontend SPA with Socket.IO disabled (serverless uses REST + auto-polling)
  run('pnpm --filter @kosmatch/web build', { VITE_DISABLE_SOCKET: 'true' });

  // 3. Bundle backend Express handler + workspace @kosmatch/shared into a single CJS file
  mkdirSync('apps/api/dist', { recursive: true });
  console.log('[build:vercel] Bundling serverless API handler...');
  await build({
    entryPoints: ['apps/api/src/vercel.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: 'apps/api/dist/vercel-bundle.cjs',
    sourcemap: false,
    // Keep Prisma external so Vercel loads its generated native query engine from node_modules
    external: ['@prisma/client'],
  });

  console.log('[build:vercel] Done!');
}

main().catch((err) => {
  console.error('[build:vercel] Failed:', err);
  process.exit(1);
});
