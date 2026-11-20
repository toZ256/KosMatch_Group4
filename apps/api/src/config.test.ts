import { describe, expect, it } from 'vitest';
import { sanitizeDatabaseUrl } from './config';

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
