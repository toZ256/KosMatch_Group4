import { randomUUID } from 'node:crypto';
import type { Bookmark, ChatHistory, Destination, Kos, User } from '@kosmatch/shared';
import type { KosFilter, Repository } from './repository';

/** In-memory Repository implementation. Data is lost on restart (accepted for this phase). */
export class InMemoryRepository implements Repository {
  private usersMap = new Map<string, User>();
  private kosMap = new Map<string, Kos>();
  private destMap = new Map<string, Destination>();
  private bookmarkList: Bookmark[] = [];
  private chatList: ChatHistory[] = [];

  users: Repository['users'] = {
    findByEmail: async (email) => {
      const needle = email.toLowerCase();
      for (const u of this.usersMap.values()) if (u.email.toLowerCase() === needle) return { ...u };
      return null;
    },
    findById: async (id) => {
      const u = this.usersMap.get(id);
      return u ? { ...u } : null;
    },
    create: async (u) => {
      const user: User = { ...u, id: randomUUID() };
      this.usersMap.set(user.id, user);
      return { ...user };
    },
  };

  kos: Repository['kos'] = {
    list: async (filter?: KosFilter) => {
      const q = filter?.q?.trim().toLowerCase();
      return [...this.kosMap.values()]
        .filter((k) => filter?.maxPrice === undefined || k.hargaSewa <= filter.maxPrice)
        .filter((k) => !filter?.tipe || k.tipe === filter.tipe)
        .filter(
          (k) => !q || k.namaKos.toLowerCase().includes(q) || k.area.toLowerCase().includes(q),
        )
        .map((k) => ({ ...k }));
    },
    get: async (id) => {
      const k = this.kosMap.get(id);
      return k ? { ...k } : null;
    },
    listByOwner: async (ownerId) =>
      [...this.kosMap.values()].filter((k) => k.ownerId === ownerId).map((k) => ({ ...k })),
    create: async (k) => {
      const kos: Kos = { ...k, id: randomUUID() };
      this.kosMap.set(kos.id, kos);
      return { ...kos };
    },
    update: async (id, patch) => {
      const existing = this.kosMap.get(id);
      if (!existing) return null;
      const updated: Kos = { ...existing, ...patch, id };
      this.kosMap.set(id, updated);
      return { ...updated };
    },
    remove: async (id) => {
      const removed = this.kosMap.delete(id);
      // Drop dangling bookmarks so lists never reference a removed kos.
      this.bookmarkList = this.bookmarkList.filter((b) => b.kosId !== id);
      return removed;
    },
  };

  destinations: Repository['destinations'] = {
    list: async () => [...this.destMap.values()].map((d) => ({ ...d })),
    get: async (id) => {
      const d = this.destMap.get(id);
      return d ? { ...d } : null;
    },
    create: async (d) => {
      this.destMap.set(d.id, { ...d });
      return { ...d };
    },
  };

  bookmarks: Repository['bookmarks'] = {
    listByUser: async (userId) =>
      this.bookmarkList.filter((b) => b.userId === userId).map((b) => ({ ...b })),
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
    remove: async (userId, kosId) => {
      const before = this.bookmarkList.length;
      this.bookmarkList = this.bookmarkList.filter((b) => !(b.userId === userId && b.kosId === kosId));
      return this.bookmarkList.length < before;
    },
  };

  chats: Repository['chats'] = {
    between: async (a, b) =>
      this.chatList
        .filter(
          (m) =>
            (m.senderId === a && m.receiverId === b) || (m.senderId === b && m.receiverId === a),
        )
        .sort((x, y) => x.sentAt.localeCompare(y.sentAt))
        .map((m) => ({ ...m })),
    conversations: async (userId) => {
      const latest = new Map<string, ChatHistory>();
      for (const m of this.chatList) {
        if (m.senderId !== userId && m.receiverId !== userId) continue;
        const other = m.senderId === userId ? m.receiverId : m.senderId;
        const prev = latest.get(other);
        if (!prev || m.sentAt >= prev.sentAt) latest.set(other, m);
      }
      return [...latest.entries()]
        .map(([otherUserId, last]) => ({ otherUserId, last: { ...last } }))
        .sort((x, y) => y.last.sentAt.localeCompare(x.last.sentAt));
    },
    add: async (m) => {
      const message: ChatHistory = {
        id: randomUUID(),
        senderId: m.senderId,
        receiverId: m.receiverId,
        pesan: m.pesan,
        sentAt: m.sentAt ?? new Date().toISOString(),
      };
      this.chatList.push(message);
      return { ...message };
    },
  };
}
