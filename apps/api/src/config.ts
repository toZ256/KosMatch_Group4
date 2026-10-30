import fs from 'node:fs';
import path from 'node:path';

export interface AppConfig {
  port: number;
  jwtSecret: string;
  useMockAi: boolean;
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

/** Reads configuration from environment variables (defaults are dev-friendly). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  loadDotenvFiles();
  return {
    port: Number(env.PORT ?? 4000),
    jwtSecret: env.JWT_SECRET ?? 'dev-secret-change-me',
    useMockAi: (env.USE_MOCK_AI ?? 'true') === 'true',
    dataStore: env.DATA_STORE ?? (env.DATABASE_URL ? 'postgres' : 'memory'),
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
  };
}
