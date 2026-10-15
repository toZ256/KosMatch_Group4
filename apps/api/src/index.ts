import { createServer } from 'node:http';
import { createApp } from './app';
import { loadConfig } from './config';
import { createRepository } from './data';
import { createCommuteProvider } from './providers/commute';
import { createLlmProvider } from './providers/llm';
import { attachSocket } from './socket';

async function main() {
  const config = loadConfig();
  const repo = await createRepository(config.dataStore);
  const llm = createLlmProvider(config.useMockAi);
  const commute = createCommuteProvider(config.useMockAi);

  const { app, services } = createApp({
    repo,
    llm,
    commute,
    jwtSecret: config.jwtSecret,
    corsOrigin: config.corsOrigin,
  });
  const server = createServer(app);
  attachSocket(server, {
    repo,
    chats: services.chats,
    jwtSecret: config.jwtSecret,
    corsOrigin: config.corsOrigin,
  });

  server.listen(config.port, () => {
    console.log(`[api] listening on http://localhost:${config.port} (ai=mock, data=${config.dataStore})`);
  });
}

main().catch((err: unknown) => {
  console.error('[api] failed to start:', err instanceof Error ? err.message : err);
  process.exit(1);
});
