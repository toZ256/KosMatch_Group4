import cors from 'cors';
import express, { type Express } from 'express';
import type { Repository } from './data/repository';
import { errorHandler, notFoundHandler } from './middleware/http';
import type { CommuteProvider } from './providers/commute';
import type { LlmProvider } from './providers/llm';
import { createApiRouter, type Services } from './routes';
import { AuthService } from './services/authService';
import { BookmarkService, ChatService } from './services/chatAndBookmarkService';
import { ChatbotService } from './services/chatbotService';
import { KosService } from './services/kosService';

export interface AppDeps {
  repo: Repository;
  llm: LlmProvider;
  commute: CommuteProvider;
  jwtSecret: string;
  corsOrigin?: string;
}

export function createApp(deps: AppDeps): { app: Express; services: Services } {
  const services: Services = {
    auth: new AuthService(deps.repo, deps.jwtSecret),
    kos: new KosService(deps.repo, deps.commute),
    chatbot: new ChatbotService(deps.repo, deps.llm, deps.commute),
    bookmarks: new BookmarkService(deps.repo),
    chats: new ChatService(deps.repo),
  };

  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: deps.corsOrigin ?? true }));
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', createApiRouter(deps.repo, services, deps.jwtSecret));
  app.use('/api', notFoundHandler);
  app.use(errorHandler);
  return { app, services };
}
