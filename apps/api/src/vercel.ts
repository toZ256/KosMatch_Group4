import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Express } from 'express';
import { createApp } from './app';
import { loadConfig } from './config';
import { createRepository } from './data';
import { createCommuteProvider } from './providers/commute';
import { createLlmProvider } from './providers/llm';

let appPromise: Promise<Express> | null = null;

/** Lazily initializes and caches the Express application across warm serverless invocations. */
export function getVercelApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = (async () => {
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
      const { app } = createApp({
        repo,
        llm,
        commute,
        jwtSecret: config.jwtSecret,
        corsOrigin: process.env.CORS_ORIGIN ? config.corsOrigin : undefined,
        mode: {
          ai: config.useMockAi ? 'mock' : 'rag',
          data: config.dataStore === 'postgres' ? 'postgres' : 'memory',
        },
      });
      return app;
    })().catch((err: unknown) => {
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

/** Vercel Node.js Serverless Function entry point wrapping the Express app. */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const app = await getVercelApp();
  await new Promise<void>((resolve, reject) => {
    res.once('finish', resolve);
    res.once('close', resolve);
    res.once('error', reject);
    app(req as Parameters<Express>[0], res as Parameters<Express>[1]);
  });
}
