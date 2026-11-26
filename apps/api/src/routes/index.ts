import { Router } from 'express';
import {
  BookmarkInputSchema,
  CommuteQuerySchema,
  JAKARTA_LOCATION_HUBS,
  KosFormSchema,
  KosQuerySchema,
  LocationSearchQuerySchema,
  LoginInputSchema,
  RegisterInputSchema,
  SendMessageInputSchema,
  type HealthResponse,
  type KosFormOutput,
  type LoginInput,
  type PlaceSuggestion,
  type RegisterInput,
  type TipeKos,
} from '@kosmatch/shared';
import type { Repository } from '../data/repository';
import { authenticate, requireRole } from '../middleware/auth';
import { AppError, asyncHandler, ok, validate } from '../middleware/http';
import { defaultGeocoder } from '../providers/commute';
import type { AuthService } from '../services/authService';
import type { BookmarkService, ChatService } from '../services/chatAndBookmarkService';
import type { ChatbotService } from '../services/chatbotService';
import type { KosService } from '../services/kosService';
import { createChatbotRouter } from './chatbot';

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

export function createApiRouter(
  repo: Repository,
  services: Services,
  jwtSecret: string,
  mode: HealthResponse['mode'] = { ai: 'mock', data: 'memory' },
): Router {
  const router = Router();
  const auth = authenticate(repo, jwtSecret);

  router.get('/health', (_req, res) => {
    const data: HealthResponse = { status: 'ok', mode };
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
    asyncHandler(async (_req, res) => {
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      ok(res, await repo.destinations.list());
    }),
  );
  router.get(
    '/locations/search',
    validate(LocationSearchQuerySchema, 'query'),
    asyncHandler(async (req, res) => {
      const q = String((req.query as { q: string }).q).trim();
      const lower = q.toLowerCase();
      const results: PlaceSuggestion[] = [];
      const seenLabels = new Set<string>();

      const pushUnique = (item: PlaceSuggestion) => {
        const key = item.label.toLowerCase();
        if (seenLabels.has(key)) return;
        seenLabels.add(key);
        results.push(item);
      };

      // 1. Built-in main destinations (campuses, offices, stations)
      const destinations = await repo.destinations.list();
      for (const d of destinations) {
        if (
          d.nama.toLowerCase().includes(lower) ||
          d.aliases.some((a) => a.toLowerCase().includes(lower))
        ) {
          pushUnique({
            id: `dest-${d.id}`,
            label: d.nama,
            subtitle:
              d.kategori === 'kampus'
                ? 'Kampus Utama'
                : d.kategori === 'stasiun'
                  ? 'Stasiun / Transit'
                  : 'Kawasan Perkantoran',
            category: 'destinasi',
            latitude: d.latitude,
            longitude: d.longitude,
            destinationId: d.id,
          });
        }
      }

      // 2. Built-in Greater Jakarta corridors & hubs
      for (const hub of JAKARTA_LOCATION_HUBS) {
        if (
          hub.name.toLowerCase().includes(lower) ||
          hub.region.toLowerCase().includes(lower) ||
          hub.aliases.some((a) => a.toLowerCase().includes(lower)) ||
          hub.nearbyAreas.some((a) => a.toLowerCase().includes(lower))
        ) {
          pushUnique({
            id: `hub-${hub.id}`,
            label: hub.name,
            subtitle: `${hub.region} · Sekitar ${hub.nearbyAreas.slice(0, 2).join(', ')}`,
            category: 'kawasan',
            latitude: hub.latitude,
            longitude: hub.longitude,
            destinationId: hub.id,
          });
        }
      }

      // 3. OpenStreetMap dynamic places (buildings, malls, stadiums, offices, streets)
      const osmPlaces = await defaultGeocoder.searchPlaces(q, 6);
      for (const place of osmPlaces) {
        pushUnique(place);
      }

      ok(res, results.slice(0, 8));
    }),
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
        destLat?: number;
        destLng?: number;
        destName?: string;
        limit?: number;
        sort?: 'rating' | 'price_asc' | 'price_desc';
      };
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
      ok(res, await services.kos.list(q));
    }),
  );
  router.get(
    '/kos/:id',
    asyncHandler(async (req, res) => {
      const destinationId = typeof req.query.destinationId === 'string' ? req.query.destinationId : undefined;
      const destLat =
        typeof req.query.destLat === 'string' && req.query.destLat !== '' && Number.isFinite(Number(req.query.destLat))
          ? Number(req.query.destLat)
          : undefined;
      const destLng =
        typeof req.query.destLng === 'string' && req.query.destLng !== '' && Number.isFinite(Number(req.query.destLng))
          ? Number(req.query.destLng)
          : undefined;
      const destName = typeof req.query.destName === 'string' ? req.query.destName : undefined;
      ok(res, await services.kos.get(param(req.params.id), { destinationId, destLat, destLng, destName }));
    }),
  );
  router.get(
    '/commute',
    validate(CommuteQuerySchema, 'query'),
    asyncHandler(async (req, res) => {
      const q = req.query as unknown as {
        kosId: string;
        destinationId?: string;
        destLat?: number;
        destLng?: number;
        destName?: string;
      };
      ok(
        res,
        await services.kos.commuteFor(q.kosId, {
          destinationId: q.destinationId,
          destLat: q.destLat,
          destLng: q.destLng,
          destName: q.destName,
        }),
      );
    }),
  );

  /* ---- chatbot (Agentic + 4-Layer Guardrails) ---- */
  router.use('/chatbot', createChatbotRouter(services.chatbot, auth));

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
  router.delete(
    '/chats/messages/:id',
    auth,
    asyncHandler(async (req, res) => {
      await services.chats.delete(requireUser(req), param(req.params.id));
      ok(res, { id: param(req.params.id), deleted: true });
    }),
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
