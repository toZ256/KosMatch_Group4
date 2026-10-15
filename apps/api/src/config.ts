export interface AppConfig {
  port: number;
  jwtSecret: string;
  useMockAi: boolean;
  dataStore: string;
  corsOrigin: string;
}

/** Reads configuration from environment variables (defaults are dev-friendly). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? 4000),
    jwtSecret: env.JWT_SECRET ?? 'dev-secret-change-me',
    useMockAi: (env.USE_MOCK_AI ?? 'true') === 'true',
    dataStore: env.DATA_STORE ?? 'memory',
    corsOrigin: env.CORS_ORIGIN ?? 'http://localhost:5173',
  };
}
