import { Router } from 'express';
import {
  BookmarkInputSchema,
  ChatbotInputSchema,
  CommuteQuerySchema,
  KosFormSchema,
  KosQuerySchema,
  LoginInputSchema,
  RegisterInputSchema,
  SendMessageInputSchema,
  type HealthResponse,
  type KosFormOutput,
  type LoginInput,
  type RegisterInput,
  type TipeKos,
} from '@kosmatch/shared';
import type { Repository } from '../data/repository';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError, asyncHandler, ok, validate } from '../middleware/http';
import type { AuthService } from '../services/authService';
import type { BookmarkService, ChatService } from '../services/chatAndBookmarkService';
import type { ChatbotService } from '../services/chatbotService';
import type { KosService } from '../services/kosService';

export interface Services {
  auth: AuthService;
  kos: KosService;
  chatbot: ChatbotService;
  bookmarks: BookmarkService;
  chats: ChatService;
}

const requireUser = (req: { user?: { id: string } }): string => {
  if (!req.user) throw new AppError('UNAUTHORIZED', 'Silakan masuk terlebih dahulu');
  return req.user.id;
};

const param = (value: string | string[] | undefined): string => (Array.isArray(value) ? (value[0] ?? '') : (value ?? ''));

export function createApiRouter(repo: Repository, services: Services, jwtSecret: string): Router {
  const router = Router();
  const auth = authenticate(repo, jwtSecret);

  router.get('/health', (_req, res) => {
    const data: HealthResponse = { status: 'ok', mode: { ai: 'mock', data: 'memory' } };
    ok(res, data);
  });

  /* ---- auth ---- */
  router.post(
    '/auth/register',
    validate(RegisterInputSchema),
    asyncHandler(async (req, res) => ok(res, await services.auth.register(req.body as RegisterInput), 201)),
  );
  router.post(
    '/auth/login',
    validate(LoginInputSchema),
    asyncHandler(async (req, res) => ok(res, await services.auth.login(req.body as LoginInput))),
  );
  router.get('/auth/me', auth, (req, res) => ok(res, req.user));

  /* ---- public data ---- */
  router.get(
    '/destinations',
    asyncHandler(async (_req, res) => ok(res, await repo.destinations.list())),
  );
  router.get(
    '/kos',
    validate(KosQuerySchema, 'query'),
    asyncHandler(async (req, res) => {
      const q = req.query as unknown as {
        q?: string;
        maxPrice?: number;
        tipe?: TipeKos;
        destinationId?: string;
      };
      ok(res, await services.kos.list(q));
    }),
  );
  router.get(
    '/kos/:id',
    asyncHandler(async (req, res) => {
      const destinationId = typeof req.query.destinationId === 'string' ? req.query.destinationId : undefined;
      ok(res, await services.kos.get(param(req.params.id), destinationId));
    }),
  );
  router.get(
    '/commute',
    validate(CommuteQuerySchema, 'query'),
    asyncHandler(async (req, res) => {
      const q = req.query as unknown as { kosId: string; destinationId: string };
      ok(res, await services.kos.commuteFor(q.kosId, q.destinationId));
    }),
  );

  /* ---- chatbot ---- */
  router.post(
    '/chatbot',
    auth,
    requireRole('tenant'),
    validate(ChatbotInputSchema),
    asyncHandler(async (req, res) => ok(res, await services.chatbot.ask((req.body as { message: string }).message))),
  );

  /* ---- bookmarks ---- */
  router.get(
    '/bookmarks',
    auth,
    asyncHandler(async (req, res) => ok(res, await services.bookmarks.list(requireUser(req)))),
  );
  router.post(
    '/bookmarks',
    auth,
    validate(BookmarkInputSchema),
    asyncHandler(async (req, res) =>
      ok(res, await services.bookmarks.add(requireUser(req), (req.body as { kosId: string }).kosId), 201),
    ),
  );
  router.delete(
    '/bookmarks/:kosId',
    auth,
    asyncHandler(async (req, res) => {
      await services.bookmarks.remove(requireUser(req), param(req.params.kosId));
      ok(res, { kosId: param(req.params.kosId), bookmarked: false });
    }),
  );

  /* ---- users (minimal public profile, needed to open a chat) ---- */
  router.get(
    '/users/:id',
    auth,
    asyncHandler(async (req, res) => ok(res, await services.chats.getPublicUser(param(req.params.id)))),
  );

  /* ---- chats (REST fallback; real-time goes through Socket.IO) ---- */
  router.get(
    '/chats/conversations',
    auth,
    asyncHandler(async (req, res) => ok(res, await services.chats.conversations(requireUser(req)))),
  );
  router.get(
    '/chats/:otherUserId',
    auth,
    asyncHandler(async (req, res) =>
      ok(res, await services.chats.history(requireUser(req), param(req.params.otherUserId))),
    ),
  );
  router.post(
    '/chats/:otherUserId',
    auth,
    validate(SendMessageInputSchema),
    asyncHandler(async (req, res) =>
      ok(
        res,
        await services.chats.send(requireUser(req), param(req.params.otherUserId), (req.body as { pesan: string }).pesan),
        201,
      ),
    ),
  );

  /* ---- owner ---- */
  const owner = Router();
  owner.use(auth, requireRole('owner'));
  owner.get(
    '/kos',
    asyncHandler(async (req, res) => ok(res, await services.kos.listByOwner(requireUser(req)))),
  );
  owner.post(
    '/kos',
    validate(KosFormSchema),
    asyncHandler(async (req, res) => ok(res, await services.kos.create(requireUser(req), req.body as KosFormOutput), 201)),
  );
  owner.put(
    '/kos/:id',
    validate(KosFormSchema),
    asyncHandler(async (req, res) =>
      ok(res, await services.kos.update(requireUser(req), param(req.params.id), req.body as KosFormOutput)),
    ),
  );
  owner.delete(
    '/kos/:id',
    asyncHandler(async (req, res) => {
      await services.kos.remove(requireUser(req), param(req.params.id));
      ok(res, { id: param(req.params.id), deleted: true });
    }),
  );
  router.use('/owner', owner);

  return router;
}
