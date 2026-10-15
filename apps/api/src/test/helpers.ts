import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { createApp } from '../app';
import { createRepository } from '../data';
import type { Repository } from '../data/repository';
import { MockCommuteProvider } from '../providers/commute/MockCommuteProvider';
import { MockLlmProvider } from '../providers/llm/MockLlmProvider';
import { attachSocket } from '../socket';

export const JWT_SECRET = 'test-secret';

export interface TestContext {
  repo: Repository;
  server: Server;
  url: string;
  api: ReturnType<typeof request>;
  close: () => Promise<void>;
}

/** Boots a fresh seeded app (HTTP + Socket.IO) on a random port. */
export async function createTestContext(): Promise<TestContext> {
  const repo = await createRepository('memory');
  const { app, services } = createApp({
    repo,
    llm: new MockLlmProvider(),
    commute: new MockCommuteProvider(),
    jwtSecret: JWT_SECRET,
  });
  const server = createServer(app);
  const io = attachSocket(server, { repo, chats: services.chats, jwtSecret: JWT_SECRET });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const url = `http://localhost:${(server.address() as AddressInfo).port}`;
  return {
    repo,
    server,
    url,
    api: request(server),
    close: async () => {
      await io.close();
    },
  };
}

export async function login(ctx: TestContext, email: string): Promise<{ token: string; id: string }> {
  const res = await ctx.api.post('/api/auth/login').send({ email, password: 'password123' });
  return { token: res.body.data.token as string, id: res.body.data.user.id as string };
}
