import fs from 'node:fs';
import path from 'node:path';

export interface AppConfig {
  port: number;
  jwtSecret: string;
  useMockAi: boolean;
  commuteProvider: string;
  osrmBaseUrl: string;
  llmBaseUrl: string;
  llmApiKey: string;
  llmModel: string;
  dataStore: string;
  corsOrigin: string;
}

function loadDotenvFiles(): void {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(process.cwd(), '../.env'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eq = trimmed.indexOf('=');
          if (eq > 0) {
            const key = trimmed.slice(0, eq).trim();
            let val = trimmed.slice(eq + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (!(key in process.env)) {
              process.env[key] = val;
            }
          }
        }
      } catch {
        // ignore read error
      }
      break;
    }
  }
}

export function sanitizeDatabaseUrl(url?: string): string | undefined {
  if (!url) return url;
  // Prisma Rust engine does not support channel_binding (often auto-added by Neon connection strings).
  return url
    .replace(/([?&])channel_binding=[^&]+(&|$)/g, (_match, prefix, suffix) => (suffix === '&' ? prefix : ''))
    .replace(/[?&]$/, '');
}

const INSECURE_JWT_SECRETS = new Set([
  'dev-secret-change-me',
  'change-me-in-production',
  'dev-jwt-secret',
]);

/** Reads configuration from environment variables (defaults are dev-friendly). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  loadDotenvFiles();
  if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = sanitizeDatabaseUrl(process.env.DATABASE_URL);
  }
  const jwtSecret = env.JWT_SECRET?.trim() || 'dev-secret-change-me';
  if (env.NODE_ENV === 'production' && (!env.JWT_SECRET?.trim() || INSECURE_JWT_SECRETS.has(jwtSecret))) {
    throw new Error('JWT_SECRET wajib disetel dengan secret acak yang aman pada mode production');
  }
  const useMockAi = (env.USE_MOCK_AI ?? 'false') === 'true';
  return {
    port: Number(env.PORT ?? 4000),
    jwtSecret,
    useMockAi,
    commuteProvider: env.COMMUTE_PROVIDER ?? (useMockAi ? 'mock' : 'osrm'),
    osrmBaseUrl: env.OSRM_BASE_URL ?? 'https://router.project-osrm.org',
    llmBaseUrl: env.LLM_BASE_URL ?? 'https://generativelanguage.googleapis.com/v1beta',
    llmApiKey: env.GEMINI_API_KEY ?? env.LLM_API_KEY ?? '',
    llmModel: env.LLM_MODEL ?? 'gemini-2.5-flash',
    dataStore: env.DATA_STORE ?? (env.DATABASE_URL ? 'postgres' : 'memory'),
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
  };
}
