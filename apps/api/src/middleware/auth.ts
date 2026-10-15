import jwt from 'jsonwebtoken';
import type { RequestHandler } from 'express';
import type { PublicUser, Role } from '@kosmatch/shared';
import type { Repository } from '../data/repository';
import { AppError, asyncHandler } from './http';

declare module 'express-serve-static-core' {
  interface Request {
    user?: PublicUser;
  }
}

export interface TokenPayload {
  sub: string;
  role: Role;
}

export function signToken(user: PublicUser, secret: string): string {
  const payload: TokenPayload = { sub: user.id, role: user.role };
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifyToken(token: string, secret: string): TokenPayload {
  const decoded = jwt.verify(token, secret);
  if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
    throw new Error('Invalid token payload');
  }
  return decoded as TokenPayload;
}

export const toPublicUser = (u: { id: string; nama: string; email: string; role: Role }): PublicUser => ({
  id: u.id,
  nama: u.nama,
  email: u.email,
  role: u.role,
});

/** Requires a valid Bearer JWT and attaches the PublicUser to req.user. */
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

export const requireRole =
  (role: Role): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(new AppError('UNAUTHORIZED', 'Silakan masuk terlebih dahulu'));
    if (req.user.role !== role) return next(new AppError('FORBIDDEN', 'Kamu tidak punya akses ke fitur ini'));
    next();
  };
