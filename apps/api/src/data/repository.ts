import type { Bookmark, ChatHistory, Destination, Kos, User } from '@kosmatch/shared';

export interface KosFilter {
  maxPrice?: number;
  q?: string;
  tipe?: string;
}

/** Storage abstraction. Services depend on this interface only. */
export interface Repository {
  users: {
    findByEmail(email: string): Promise<User | null>;
    findById(id: string): Promise<User | null>;
    create(u: Omit<User, 'id'>): Promise<User>;
  };
  kos: {
    list(filter?: KosFilter): Promise<Kos[]>;
    get(id: string): Promise<Kos | null>;
    listByOwner(ownerId: string): Promise<Kos[]>;
    create(k: Omit<Kos, 'id'>): Promise<Kos>;
    update(id: string, patch: Partial<Omit<Kos, 'id'>>): Promise<Kos | null>;
    remove(id: string): Promise<boolean>;
  };
  destinations: {
    list(): Promise<Destination[]>;
    get(id: string): Promise<Destination | null>;
    /** Used by the seed to load fixed destinations. */
    create(d: Destination): Promise<Destination>;
  };
  bookmarks: {
    listByUser(userId: string): Promise<Bookmark[]>;
    /** Idempotent: adding an existing bookmark returns the existing one. */
    add(userId: string, kosId: string): Promise<Bookmark>;
    remove(userId: string, kosId: string): Promise<boolean>;
  };
  chats: {
    between(a: string, b: string): Promise<ChatHistory[]>;
    conversations(userId: string): Promise<{ otherUserId: string; last: ChatHistory }[]>;
    add(m: Omit<ChatHistory, 'id' | 'sentAt'> & { sentAt?: string }): Promise<ChatHistory>;
  };
}
