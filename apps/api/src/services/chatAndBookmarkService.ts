import type { ChatHistory, ConversationSummary, Kos } from '@kosmatch/shared';
import type { Repository } from '../data/repository';
import { toPublicUser } from '../middleware/auth';
import { AppError } from '../middleware/http';

export class BookmarkService {
  constructor(private readonly repo: Repository) {}

  async list(userId: string): Promise<Kos[]> {
    const bookmarks = await this.repo.bookmarks.listByUser(userId);
    const result: Kos[] = [];
    for (const b of bookmarks) {
      const kos = await this.repo.kos.get(b.kosId);
      if (kos) result.push(kos);
    }
    return result;
  }

  async add(userId: string, kosId: string) {
    if (!(await this.repo.kos.get(kosId))) throw new AppError('NOT_FOUND', 'Kos tidak ditemukan');
    return this.repo.bookmarks.add(userId, kosId);
  }

  /** Idempotent: removing a missing bookmark still succeeds. */
  async remove(userId: string, kosId: string): Promise<void> {
    await this.repo.bookmarks.remove(userId, kosId);
  }
}

export type MessageListener = (message: ChatHistory) => void;

export class ChatService {
  private listeners = new Set<MessageListener>();

  constructor(private readonly repo: Repository) {}

  /** Subscribe to every stored message (used by Socket.IO to push real-time events). */
  onMessage(listener: MessageListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async send(senderId: string, receiverId: string, pesan: string): Promise<ChatHistory> {
    if (senderId === receiverId) throw new AppError('VALIDATION_ERROR', 'Tidak bisa mengirim pesan ke diri sendiri');
    if (!(await this.repo.users.findById(receiverId))) throw new AppError('NOT_FOUND', 'Penerima tidak ditemukan');
    const message = await this.repo.chats.add({ senderId, receiverId, pesan });
    for (const listener of this.listeners) listener(message);
    return message;
  }

  async history(userId: string, otherUserId: string): Promise<ChatHistory[]> {
    if (!(await this.repo.users.findById(otherUserId))) throw new AppError('NOT_FOUND', 'Pengguna tidak ditemukan');
    return this.repo.chats.between(userId, otherUserId);
  }

  async conversations(userId: string): Promise<ConversationSummary[]> {
    const raw = await this.repo.chats.conversations(userId);
    const result: ConversationSummary[] = [];
    for (const c of raw) {
      const other = await this.repo.users.findById(c.otherUserId);
      if (other) result.push({ otherUser: toPublicUser(other), last: c.last });
    }
    return result;
  }

  async getPublicUser(id: string) {
    const user = await this.repo.users.findById(id);
    if (!user) throw new AppError('NOT_FOUND', 'Pengguna tidak ditemukan');
    return toPublicUser(user);
  }
}
