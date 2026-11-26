import { describe, expect, it } from 'vitest';
import { loadConfig, sanitizeDatabaseUrl } from './config';

describe('sanitizeDatabaseUrl', () => {
  it('strips channel_binding parameter from database URLs', () => {
    const raw =
      'postgresql://user:pass@ep-sample.tech/db?sslmode=require&channel_binding=require';
    expect(sanitizeDatabaseUrl(raw)).toBe(
      'postgresql://user:pass@ep-sample.tech/db?sslmode=require',
    );
  });

  it('handles channel_binding as sole or middle parameter', () => {
    expect(
      sanitizeDatabaseUrl('postgresql://user:pass@ep-sample.tech/db?channel_binding=require'),
    ).toBe('postgresql://user:pass@ep-sample.tech/db');

    expect(
      sanitizeDatabaseUrl(
        'postgresql://user:pass@ep-sample.tech/db?channel_binding=require&sslmode=require',
      ),
    ).toBe('postgresql://user:pass@ep-sample.tech/db?sslmode=require');
  });

  it('leaves clean URLs intact and handles undefined', () => {
    expect(sanitizeDatabaseUrl(undefined)).toBeUndefined();
    expect(
      sanitizeDatabaseUrl('postgresql://user:pass@localhost:5432/db?sslmode=require'),
    ).toBe('postgresql://user:pass@localhost:5432/db?sslmode=require');
  });
});

describe('loadConfig', () => {
  it('rejects missing or default JWT_SECRET in production mode', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'change-me-in-production' })).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'dev-secret-change-me' })).toThrow(/JWT_SECRET/);
  });

  it('accepts strong JWT_SECRET in production mode and dev defaults otherwise', () => {
    const prod = loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'a-very-strong-random-production-secret' });
    expect(prod.jwtSecret).toBe('a-very-strong-random-production-secret');

    const dev = loadConfig({ NODE_ENV: 'test' });
    expect(dev.jwtSecret).toBe('dev-secret-change-me');
  });
});
