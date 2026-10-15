import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { SocketSendInputSchema, type ChatHistory } from '@kosmatch/shared';
import { verifyToken } from './middleware/auth';
import type { Repository } from './data/repository';
import type { ChatService } from './services/chatAndBookmarkService';
import { AppError } from './middleware/http';

interface SocketDeps {
  repo: Repository;
  chats: ChatService;
  jwtSecret: string;
  corsOrigin?: string;
}

type Ack = (res: { ok: true; message: ChatHistory } | { ok: false; error: string }) => void;

/** Attaches Socket.IO: JWT handshake auth, per-user rooms, message:send / message:new. */
export function attachSocket(httpServer: HttpServer, deps: SocketDeps): Server {
  const io = new Server(httpServer, {
    cors: { origin: deps.corsOrigin ?? true },
  });

  io.use(async (socket, next) => {
    try {
      const token = (socket.handshake.auth as { token?: unknown }).token;
      if (typeof token !== 'string' || !token) return next(new Error('UNAUTHORIZED'));
      const payload = verifyToken(token, deps.jwtSecret);
      const user = await deps.repo.users.findById(payload.sub);
      if (!user) return next(new Error('UNAUTHORIZED'));
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  // Stored messages (from socket or REST) are pushed to both sender and receiver rooms.
  deps.chats.onMessage((message) => {
    io.to(`user:${message.receiverId}`).to(`user:${message.senderId}`).emit('message:new', message);
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    void socket.join(`user:${userId}`);

    socket.on('message:send', async (payload: unknown, ack?: Ack) => {
      const reply = typeof ack === 'function' ? ack : () => undefined;
      const parsed = SocketSendInputSchema.safeParse(payload);
      if (!parsed.success) {
        return reply({ ok: false, error: parsed.error.issues[0]?.message ?? 'Pesan tidak valid' });
      }
      try {
        const message = await deps.chats.send(userId, parsed.data.receiverId, parsed.data.pesan);
        reply({ ok: true, message });
      } catch (err) {
        reply({ ok: false, error: err instanceof AppError ? err.message : 'Gagal mengirim pesan' });
      }
    });
  });

  return io;
}
