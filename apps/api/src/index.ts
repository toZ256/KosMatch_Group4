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
  const llm = createLlmProvider(config.useMockAi, {
    baseUrl: config.llmBaseUrl,
    apiKey: config.llmApiKey,
    model: config.llmModel,
  });
  const commute = createCommuteProvider(config.commuteProvider, {
    baseUrl: config.osrmBaseUrl,
  });

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
    const aiMode = config.useMockAi ? 'mock' : `rag(${config.llmBaseUrl})`;
    console.log(
      `[api] listening on http://localhost:${config.port} (ai=${aiMode}, commute=${config.commuteProvider}, data=${config.dataStore})`,
    );
  });
}

main().catch((err: unknown) => {
  console.error('[api] failed to start:', err instanceof Error ? err.message : err);
  process.exit(1);
});
