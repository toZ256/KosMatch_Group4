import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError, type ZodTypeAny } from 'zod';
import type { ErrorCode } from '@kosmatch/shared';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.status = STATUS_BY_CODE[code];
  }
}

export const ok = <T>(res: Response, data: T, status = 200) =>
  res.status(status).json({ ok: true, data });

/** Wraps an async handler so rejected promises reach the central error handler. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

/** Validates and replaces req.body / req.query with the parsed Zod output. */
export const validate =
  (schema: ZodTypeAny, source: 'body' | 'query' = 'body'): RequestHandler =>
  (req, _res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) return next(parsed.error);
    req[source] = parsed.data as never;
    next();
  };

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new AppError('NOT_FOUND', 'Endpoint tidak ditemukan'));
};

/** Central error handler. Never leaks stack traces to the client. */
export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    const message = err.issues[0]?.message ?? 'Input tidak valid';
    return res.status(400).json({ ok: false, error: { code: 'VALIDATION_ERROR', message } });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ ok: false, error: { code: err.code, message: err.message } });
  }
  if (err instanceof SyntaxError && 'body' in err) {
    return res
      .status(400)
      .json({ ok: false, error: { code: 'VALIDATION_ERROR', message: 'Format JSON tidak valid' } });
  }
  console.error('[api] unhandled error:', err);
  return res
    .status(500)
    .json({ ok: false, error: { code: 'INTERNAL', message: 'Terjadi kesalahan pada server' } });
};
