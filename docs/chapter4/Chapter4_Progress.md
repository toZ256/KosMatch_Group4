# Chapter 4: Coding Progress

## 4.1 Implementation Overview

At the current stage, KosMatch Jakarta has been implemented as a TypeScript monorepo consisting of a React web client, an Express REST API with Socket.IO for real-time messaging, and a shared package containing Zod validation schemas and types. The core user flows (authentication, kos search with commute estimates, the AI chatbot, bookmarks, real-time chat between tenants and owners, and owner listing management) are functional end to end. However, two external dependencies are deliberately substituted in this phase: natural-language understanding is handled by a rule-based `MockLlmProvider`, and commute estimates are produced by a deterministic `MockCommuteProvider` instead of the Google Maps API. All data is held in an `InMemoryRepository` that is re-seeded on every server start, so no persistent database, deployment, or user acceptance testing has been carried out yet.

**Table 4.1 Implementation Status**

| Feature | Responsible Role | Status | Evidence (path file) |
|---|---|---|---|
| AI Chatbot Kos Search | [FILL IN] | Implemented with mock | `apps/api/src/providers/llm/MockLlmProvider.ts`, `apps/api/src/services/chatbotService.ts`, `apps/web/src/components/chatbot/ChatbotOverlay.tsx` |
| Real-Time Chat User & Owner | [FILL IN] | Implemented (in-memory storage) | `apps/api/src/socket.ts`, `apps/api/src/services/chatAndBookmarkService.ts`, `apps/web/src/components/chat/ChatParts.tsx`, `apps/web/src/pages/ChatPage.tsx` |
| Kos Bookmark | [FILL IN] | Implemented (in-memory storage) | `apps/api/src/routes/index.ts` (bookmark routes), `apps/api/src/data/inMemoryRepository.ts`, `apps/web/src/components/kos/BookmarkButton.tsx` |
| CI/CD Infrastructure & Release | [FILL IN] | Partial (CI workflow defined; no CD/release pipeline; remote run not verified) | `.github/workflows/ci.yml` |
| UI/UX Design & Chatbot Interface | [FILL IN] | Implemented (design documentation: [FILL IN]) | `apps/web/src/pages/`, `apps/web/src/components/`, `apps/web/tailwind.config.ts` |
| LLM & Maps Integration | [FILL IN] | Not started (mock providers only) | `apps/api/src/providers/llm/LlmProvider.ts`, `apps/api/src/providers/commute/CommuteProvider.ts` (interfaces ready) |
| Chat & Bookmark Database Schema | [FILL IN] | Partial (Zod schemas and Repository interface; no PostgreSQL schema) | `packages/shared/src/schemas.ts`, `apps/api/src/data/repository.ts` |
| Cloud Hosting | [FILL IN] | Not started | — |
| User Acceptance Testing | [FILL IN] | Not started | — |

## 4.2 System Structure Implemented

```
KosMatch_Group4/
├── .github/
│   └── workflows/          # ci.yml (lint, typecheck, test, build)
├── apps/
│   ├── api/                # Express + Socket.IO backend
│   │   └── src/            # data/, middleware/, providers/, routes/, services/, socket.ts
│   └── web/                # React + Vite + Tailwind frontend
│       └── src/            # api/, components/, lib/, pages/, stores/
├── packages/
│   └── shared/             # Zod schemas, types, constants
│       └── src/
├── docs/                   # PRD.md, PROGRESS.md, chapter4/
├── package.json            # root scripts (dev, lint, typecheck, test, build)
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

The project is organised as a pnpm workspace monorepo so that the frontend and backend share a single source of truth for validation schemas and types through `packages/shared`. Backend services depend only on three interfaces, namely `Repository`, `LlmProvider`, and `CommuteProvider`, while concrete implementations are injected through factories in `apps/api/src/app.ts` according to environment variables (`USE_MOCK_AI`, `DATA_STORE`). Mock providers and in-memory storage were chosen for this phase to avoid API costs and credential management, to keep tests deterministic and offline, and to allow the team to validate user flows before committing to a database schema. Because of the interface-based design, replacing these components with a real LLM, the Google Maps API, or PostgreSQL should not require changes to the service layer.

## 4.3 Key Code Excerpts

**Listing 4.1 Provider interfaces** (`apps/api/src/providers/llm/LlmProvider.ts`, lines 3–7; `apps/api/src/providers/commute/CommuteProvider.ts`, lines 3–6)

```ts
/** Turns natural language into search params and composes replies. Services depend on this only. */
export interface LlmProvider {
  extractParams(message: string, destinations: Destination[]): Promise<ChatParams>;
  composeReply(params: ChatParams, resultCount: number): Promise<string>;
}

/** Estimates commute between a kos and a destination. Services depend on this interface only. */
export interface CommuteProvider {
  estimate(kos: Kos, dest: Destination, mode?: TransportMode): Promise<CommuteEstimate[]>;
}
```

These two interfaces form the boundary between the business logic and external intelligence services. The chatbot service calls `extractParams` to convert a user message into structured search parameters and `composeReply` to generate a response, without knowing whether a mock or a real LLM is behind it.

**Listing 4.2 Deterministic commute estimation** (`apps/api/src/providers/commute/MockCommuteProvider.ts`, lines 22–41)

```ts
    const straight = haversineKm(kos.latitude, kos.longitude, dest.latitude, dest.longitude);
    const km = round1(straight * 1.3);

    const base = { destinationId: dest.id, distanceKm: km, isEstimate: true, source: 'mock' } as const;
    const all: CommuteEstimate[] = [
      {
        ...base,
        mode: 'ojek',
        durationMin: ceilMinutes((km / 22) * 60),
        costRp: Math.max(8000, roundTo500(3000 * km)),
        transitTransfers: 0,
      },
      {
        ...base,
        mode: 'transit',
        durationMin: ceilMinutes((km / 28) * 60 + 10),
        costRp: Math.min(10000, roundTo500(3000 + 300 * km)),
        transitTransfers: km < 5 ? 0 : km < 15 ? 1 : 2,
      },
    ];
```

The mock estimator computes the great-circle (Haversine) distance and multiplies it by 1.3 to approximate road distance, then derives duration and cost per transport mode using fixed average speeds and fare rules. Every result is explicitly tagged with `isEstimate: true` and `source: 'mock'` so that the interface can always label commute figures as estimates.

**Listing 4.3 Idempotent bookmark creation** (`apps/api/src/data/inMemoryRepository.ts`, lines 82–93)

```ts
    add: async (userId, kosId) => {
      const existing = this.bookmarkList.find((b) => b.userId === userId && b.kosId === kosId);
      if (existing) return { ...existing };
      const bookmark: Bookmark = {
        id: randomUUID(),
        userId,
        kosId,
        createdAt: new Date().toISOString(),
      };
      this.bookmarkList.push(bookmark);
      return { ...bookmark };
    },
```

Adding a bookmark that already exists returns the existing record instead of creating a duplicate, which makes repeated clicks or network retries safe. Copies of objects are returned so that callers cannot mutate the internal store directly.

**Listing 4.4 JWT authentication middleware** (`apps/api/src/middleware/auth.ts`, lines 39–54)

```ts
export function authenticate(repo: Repository, secret: string): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new AppError('UNAUTHORIZED', 'Silakan masuk terlebih dahulu');
    let payload: TokenPayload;
    try {
      payload = verifyToken(header.slice(7), secret);
    } catch {
      throw new AppError('UNAUTHORIZED', 'Sesi tidak valid atau sudah berakhir');
    }
    const user = await repo.users.findById(payload.sub);
    if (!user) throw new AppError('UNAUTHORIZED', 'Pengguna tidak ditemukan');
    req.user = toPublicUser(user);
    next();
  });
}
```

The middleware validates the Bearer token, looks the user up in the repository, and attaches only a public user object (without the password hash) to the request. Protected routes such as bookmarks, chat, and the chatbot are guarded by this middleware, and owner-only routes additionally use `requireRole('owner')`.

## 4.4 User Interface Progress

The following pages exist in `apps/web/src/pages` and are wired into the router in `apps/web/src/App.tsx`:

| Page | File | Route |
|---|---|---|
| Landing page (hero, search bar, popular kos) | `LandingPage.tsx` | `/` |
| Login and Register (with demo account buttons) | `AuthPages.tsx` | `/login`, `/register` |
| Search results with filters | `SearchPage.tsx` | `/cari` |
| Kos detail with commute estimates | `KosDetailPage.tsx` | `/kos/:id` |
| Saved kos (bookmarks) | `SimplePages.tsx` | `/tersimpan` |
| Notifications (empty state; out of scope) | `SimplePages.tsx` | `/notifikasi` |
| Real-time chat | `ChatPage.tsx` | `/chat`, `/chat/:userId` |
| Owner dashboard and kos form | `OwnerPages.tsx` | `/owner/kos`, `/owner/kos/baru`, `/owner/kos/:id/edit` |
| 404 page | `SimplePages.tsx` | `*` |

The AI chatbot is implemented as a slide-in overlay (`apps/web/src/components/chatbot/ChatbotOverlay.tsx`) rather than a separate page.

[INSERT SCREENSHOT: Landing page]
*Figure 4.1 Landing page of KosMatch Jakarta*

[INSERT SCREENSHOT: AI chatbot overlay showing kos recommendations]
*Figure 4.2 AI chatbot interface with commute estimates*

[INSERT SCREENSHOT: Kos detail page]
*Figure 4.3 Kos detail page with estimated commute per transport mode*

[INSERT SCREENSHOT: Real-time chat page]
*Figure 4.4 Real-time chat between tenant and owner*

## 4.5 Testing Progress

The repository contains eight automated test files using Vitest:

| Package | Test file | Scope |
|---|---|---|
| shared | `packages/shared/src/schemas.test.ts` | Zod schema validation |
| api | `apps/api/src/data/repository.test.ts` | InMemoryRepository CRUD, idempotent bookmarks, seed |
| api | `apps/api/src/providers/llm/MockLlmProvider.test.ts` | Parameter extraction from Indonesian messages |
| api | `apps/api/src/providers/commute/MockCommuteProvider.test.ts` | Commute estimation rules |
| api | `apps/api/src/chatbot.test.ts` | Chatbot endpoint (auth, results, clarification, no results) |
| api | `apps/api/src/app.test.ts` | Health, public data, auth, owner authorisation |
| api | `apps/api/src/realtime.test.ts` | Bookmark API, chat REST, Socket.IO delivery and validation |
| web | `apps/web/src/lib/format.test.ts` | Formatting helpers |

In the most recent local run during development (15 October 2026), `pnpm test` reported 52 passing tests (3 shared, 47 API, 2 web), and `pnpm lint`, `pnpm typecheck`, and `pnpm build` completed without errors. A Playwright `test:e2e` script is declared in the root `package.json`, but no end-to-end test specifications exist in the repository yet. Results from the GitHub Actions CI run: [FILL IN]. Chatbot accuracy evaluation: [FILL IN]. User acceptance testing has not been conducted.

## 4.6 Challenges and Next Steps

1. **Mock providers and in-memory data.** All data is lost when the server restarts, and chatbot and commute outputs are rule-based approximations. These were accepted trade-offs for this phase but limit realism.
2. **Real LLM and Google Maps integration.** The next step is to implement real `LlmProvider` and `CommuteProvider` classes behind the existing interfaces, including API key management, rate limiting, caching, and fallback to the mock when external services fail.
3. **Persistent database (PostgreSQL).** A `Repository` implementation backed by PostgreSQL is needed, with tables for users, kos, bookmarks, and chat history derived from the existing Zod schemas. The factory currently throws "Provider belum diimplementasikan" for non-memory stores.
4. **Frontend completion and test coverage.** The main pages exist, but frontend testing is minimal (one unit test file) and no end-to-end tests have been written. Features such as notifications remain empty states, and photo uploads use colour placeholders.
5. **Chatbot accuracy testing.** The regex-based parser only handles limited phrasings. A test set of realistic user queries should be prepared to measure parameter-extraction accuracy before and after LLM integration.
6. **Deployment and UAT.** Cloud hosting, a continuous deployment pipeline, and user acceptance testing with prospective tenants and kos owners have not been started and are planned for the next phase. Timeline: [FILL IN].
