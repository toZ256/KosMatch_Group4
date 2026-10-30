import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { ChatHistory, Destination, Kos, TipeKos } from '@kosmatch/shared';
import type { KosFilter, Repository } from './repository';

type PrismaKos = Prisma.KosGetPayload<Record<string, never>>;
type PrismaDestination = Prisma.DestinationGetPayload<Record<string, never>>;

function toDomainKos(k: PrismaKos): Kos {
  let fasilitas: string[] = [];
  if (k.fasilitas) {
    fasilitas = k.fasilitas
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return {
    id: k.id,
    ownerId: k.ownerId ?? 'owner-bu-sari',
    namaKos: k.namaKos,
    hargaSewa: k.hargaSewa,
    latitude: k.lat,
    longitude: k.lng,
    area: k.area,
    tipe: (k.tipe as TipeKos) || 'campur',
    fasilitas,
    deskripsi: k.deskripsi ?? '',
    rating: k.rating ?? 0,
    fotoColor: k.fotoColor ?? '#B8C4D6',
  };
}

function toDomainDestination(d: PrismaDestination): Destination {
  let aliases: string[] = [];
  try {
    const parsed = JSON.parse(d.aliases);
    aliases = Array.isArray(parsed) ? parsed : [String(d.aliases)];
  } catch {
    aliases = d.aliases ? d.aliases.split(',').map((s) => s.trim()) : [];
  }
  return {
    id: d.id,
    nama: d.nama,
    kategori: d.kategori as Destination['kategori'],
    latitude: d.latitude,
    longitude: d.longitude,
    aliases,
  };
}

/** PostgreSQL & Prisma-backed Repository implementation. */
export class PrismaRepository implements Repository {
  constructor(private readonly prisma: PrismaClient) {}

  users: Repository['users'] = {
    findByEmail: async (email) => {
      const u = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      });
      if (!u) return null;
      return {
        id: u.id,
        nama: u.nama,
        email: u.email,
        passwordHash: u.passwordHash,
        role: u.role as 'tenant' | 'owner',
      };
    },
    findById: async (id) => {
      const u = await this.prisma.user.findUnique({
        where: { id },
      });
      if (!u) return null;
      return {
        id: u.id,
        nama: u.nama,
        email: u.email,
        passwordHash: u.passwordHash,
        role: u.role as 'tenant' | 'owner',
      };
    },
    create: async (u) => {
      const id = randomUUID();
      const created = await this.prisma.user.create({
        data: {
          id,
          nama: u.nama,
          email: u.email,
          passwordHash: u.passwordHash,
          role: u.role,
        },
      });
      return {
        id: created.id,
        nama: created.nama,
        email: created.email,
        passwordHash: created.passwordHash,
        role: created.role as 'tenant' | 'owner',
      };
    },
  };

  kos: Repository['kos'] = {
    list: async (filter?: KosFilter) => {
      const where: Prisma.KosWhereInput = {};
      if (filter?.maxPrice !== undefined) {
        where.hargaSewa = { lte: filter.maxPrice };
      }
      if (filter?.tipe) {
        where.tipe = filter.tipe;
      }
      if (filter?.q?.trim()) {
        const q = filter.q.trim();
        where.OR = [
          { namaKos: { contains: q, mode: 'insensitive' } },
          { area: { contains: q, mode: 'insensitive' } },
          { region: { contains: q, mode: 'insensitive' } },
          { kecamatan: { contains: q, mode: 'insensitive' } },
        ];
      }
      const items = await this.prisma.kos.findMany({
        where,
        orderBy: { createdAt: 'desc' },
      });
      return items.map(toDomainKos);
    },
    get: async (id) => {
      const k = await this.prisma.kos.findUnique({
        where: { id },
      });
      return k ? toDomainKos(k) : null;
    },
    listByOwner: async (ownerId) => {
      const items = await this.prisma.kos.findMany({
        where: { ownerId },
        orderBy: { createdAt: 'desc' },
      });
      return items.map(toDomainKos);
    },
    create: async (k) => {
      const id = randomUUID();
      const created = await this.prisma.kos.create({
        data: {
          id,
          namaKos: k.namaKos,
          area: k.area,
          region: k.area,
          kecamatan: k.area,
          tipe: k.tipe,
          hargaSewa: k.hargaSewa,
          fasilitas: Array.isArray(k.fasilitas) ? k.fasilitas.join(';') : String(k.fasilitas || ''),
          lat: k.latitude,
          lng: k.longitude,
          deskripsi: k.deskripsi,
          rating: k.rating,
          fotoColor: k.fotoColor,
          ownerId: k.ownerId,
          listrikTermasuk: false,
          dalamJakarta: true,
        },
      });
      return toDomainKos(created);
    },
    update: async (id, patch) => {
      try {
        const data: Prisma.KosUpdateInput = {};
        if (patch.namaKos !== undefined) data.namaKos = patch.namaKos;
        if (patch.area !== undefined) data.area = patch.area;
        if (patch.tipe !== undefined) data.tipe = patch.tipe;
        if (patch.hargaSewa !== undefined) data.hargaSewa = patch.hargaSewa;
        if (patch.fasilitas !== undefined) {
          data.fasilitas = Array.isArray(patch.fasilitas) ? patch.fasilitas.join(';') : String(patch.fasilitas);
        }
        if (patch.latitude !== undefined) data.lat = patch.latitude;
        if (patch.longitude !== undefined) data.lng = patch.longitude;
        if (patch.deskripsi !== undefined) data.deskripsi = patch.deskripsi;
        if (patch.rating !== undefined) data.rating = patch.rating;
        if (patch.fotoColor !== undefined) data.fotoColor = patch.fotoColor;
        if (patch.ownerId !== undefined) data.ownerId = patch.ownerId;

        const updated = await this.prisma.kos.update({
          where: { id },
          data,
        });
        return toDomainKos(updated);
      } catch {
        return null;
      }
    },
    remove: async (id) => {
      try {
        await this.prisma.bookmark.deleteMany({ where: { kosId: id } });
        await this.prisma.kos.delete({ where: { id } });
        return true;
      } catch {
        return false;
      }
    },
  };

  destinations: Repository['destinations'] = {
    list: async () => {
      const items = await this.prisma.destination.findMany();
      return items.map(toDomainDestination);
    },
    get: async (id) => {
      const d = await this.prisma.destination.findUnique({ where: { id } });
      return d ? toDomainDestination(d) : null;
    },
    create: async (d) => {
      const created = await this.prisma.destination.upsert({
        where: { id: d.id },
        update: {
          nama: d.nama,
          kategori: d.kategori,
          latitude: d.latitude,
          longitude: d.longitude,
          aliases: JSON.stringify(d.aliases),
        },
        create: {
          id: d.id,
          nama: d.nama,
          kategori: d.kategori,
          latitude: d.latitude,
          longitude: d.longitude,
          aliases: JSON.stringify(d.aliases),
        },
      });
      return toDomainDestination(created);
    },
  };

  bookmarks: Repository['bookmarks'] = {
    listByUser: async (userId) => {
      const list = await this.prisma.bookmark.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
      return list.map((b) => ({
        id: b.id,
        userId: b.userId,
        kosId: b.kosId,
        createdAt: b.createdAt.toISOString(),
      }));
    },
    add: async (userId, kosId) => {
      const existing = await this.prisma.bookmark.findUnique({
        where: { userId_kosId: { userId, kosId } },
      });
      if (existing) {
        return {
          id: existing.id,
          userId: existing.userId,
          kosId: existing.kosId,
          createdAt: existing.createdAt.toISOString(),
        };
      }
      const created = await this.prisma.bookmark.create({
        data: {
          id: randomUUID(),
          userId,
          kosId,
        },
      });
      return {
        id: created.id,
        userId: created.userId,
        kosId: created.kosId,
        createdAt: created.createdAt.toISOString(),
      };
    },
    remove: async (userId, kosId) => {
      try {
        const deleted = await this.prisma.bookmark.deleteMany({
          where: { userId, kosId },
        });
        return deleted.count > 0;
      } catch {
        return false;
      }
    },
  };

  chats: Repository['chats'] = {
    between: async (a, b) => {
      const msgs = await this.prisma.chatHistory.findMany({
        where: {
          OR: [
            { senderId: a, receiverId: b },
            { senderId: b, receiverId: a },
          ],
        },
        orderBy: { sentAt: 'asc' },
      });
      return msgs.map((m) => ({
        id: m.id,
        senderId: m.senderId,
        receiverId: m.receiverId,
        pesan: m.pesan,
        sentAt: m.sentAt.toISOString(),
      }));
    },
    conversations: async (userId) => {
      const all = await this.prisma.chatHistory.findMany({
        where: {
          OR: [{ senderId: userId }, { receiverId: userId }],
        },
        orderBy: { sentAt: 'desc' },
      });
      const latest = new Map<string, ChatHistory>();
      for (const m of all) {
        const other = m.senderId === userId ? m.receiverId : m.senderId;
        if (!latest.has(other)) {
          latest.set(other, {
            id: m.id,
            senderId: m.senderId,
            receiverId: m.receiverId,
            pesan: m.pesan,
            sentAt: m.sentAt.toISOString(),
          });
        }
      }
      return [...latest.entries()].map(([otherUserId, last]) => ({ otherUserId, last }));
    },
    add: async (m) => {
      const created = await this.prisma.chatHistory.create({
        data: {
          id: randomUUID(),
          senderId: m.senderId,
          receiverId: m.receiverId,
          pesan: m.pesan,
          sentAt: m.sentAt ? new Date(m.sentAt) : new Date(),
        },
      });
      return {
        id: created.id,
        senderId: created.senderId,
        receiverId: created.receiverId,
        pesan: created.pesan,
        sentAt: created.sentAt.toISOString(),
      };
    },
  };
}
