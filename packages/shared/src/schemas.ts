import { z } from 'zod';
import {
  FASILITAS_OPTIONS,
  KATEGORI_DESTINASI,
  MESSAGE_MAX_LENGTH,
  ROLES,
  TIPE_KOS,
  TRANSPORT_MODES,
} from './constants';

export const RoleSchema = z.enum(ROLES);
export const TipeKosSchema = z.enum(TIPE_KOS);
export const TransportModeSchema = z.enum(TRANSPORT_MODES);

export const UserSchema = z.object({
  id: z.string().uuid(),
  nama: z.string(),
  email: z.string().email(),
  passwordHash: z.string(),
  role: RoleSchema,
});

/** User shape that is safe to send to clients (no passwordHash). */
export const PublicUserSchema = UserSchema.omit({ passwordHash: true });

export const KosSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  namaKos: z.string(),
  hargaSewa: z.number(),
  latitude: z.number(),
  longitude: z.number(),
  area: z.string(),
  tipe: TipeKosSchema,
  fasilitas: z.array(z.string()),
  deskripsi: z.string(),
  rating: z.number(),
  fotoColor: z.string(),
});

export const ChatHistorySchema = z.object({
  id: z.string(),
  senderId: z.string(),
  receiverId: z.string(),
  pesan: z.string(),
  sentAt: z.string(),
});

export const BookmarkSchema = z.object({
  id: z.string(),
  userId: z.string(),
  kosId: z.string(),
  createdAt: z.string(),
});

export const DestinationSchema = z.object({
  id: z.string(),
  nama: z.string(),
  kategori: z.enum(KATEGORI_DESTINASI),
  latitude: z.number(),
  longitude: z.number(),
  aliases: z.array(z.string()),
});

export const CommuteEstimateSchema = z.object({
  destinationId: z.string(),
  mode: TransportModeSchema,
  distanceKm: z.number(),
  durationMin: z.number(),
  costRp: z.number(),
  transitTransfers: z.number(),
  isEstimate: z.literal(true),
  source: z.literal('mock'),
});

/* ---------------- Request schemas ---------------- */

export const RegisterInputSchema = z.object({
  nama: z.string().trim().min(2, 'Nama minimal 2 karakter').max(80),
  email: z.string().trim().toLowerCase().email('Email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter').max(100),
  role: RoleSchema,
});

export const LoginInputSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const KosFormSchema = z.object({
  namaKos: z.string().trim().min(3, 'Nama kos minimal 3 karakter').max(100),
  area: z.string().trim().min(2, 'Area wajib diisi').max(100),
  hargaSewa: z.coerce
    .number({ invalid_type_error: 'Harga harus berupa angka' })
    .int('Harga harus bilangan bulat')
    .min(100000, 'Harga minimal Rp 100.000')
    .max(100000000, 'Harga terlalu besar'),
  latitude: z.coerce
    .number({ invalid_type_error: 'Latitude harus berupa angka' })
    .min(-90, 'Latitude tidak valid')
    .max(90, 'Latitude tidak valid'),
  longitude: z.coerce
    .number({ invalid_type_error: 'Longitude harus berupa angka' })
    .min(-180, 'Longitude tidak valid')
    .max(180, 'Longitude tidak valid'),
  tipe: TipeKosSchema,
  fasilitas: z.array(z.enum(FASILITAS_OPTIONS)).min(1, 'Pilih minimal satu fasilitas'),
  deskripsi: z.string().trim().min(10, 'Deskripsi minimal 10 karakter').max(1000),
});

export const KosQuerySchema = z.object({
  q: z.string().trim().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  tipe: TipeKosSchema.optional(),
  destinationId: z.string().optional(),
});

export const CommuteQuerySchema = z.object({
  kosId: z.string().min(1),
  destinationId: z.string().min(1),
});

export const ChatbotInputSchema = z.object({
  message: z.string().trim().min(1, 'Pesan wajib diisi').max(500),
});

export const ChatParamsSchema = z.object({
  destinationId: z.string().optional(),
  maxBudgetMonthly: z.number().positive().optional(),
  maxCommuteMin: z.number().positive().optional(),
  maxCommuteCostRp: z.number().positive().optional(),
  preferredMode: TransportModeSchema.optional(),
  tipe: TipeKosSchema.optional(),
});

export const BookmarkInputSchema = z.object({ kosId: z.string().min(1) });

export const SendMessageInputSchema = z.object({
  pesan: z
    .string()
    .trim()
    .min(1, 'Pesan tidak boleh kosong')
    .max(MESSAGE_MAX_LENGTH, `Pesan maksimal ${MESSAGE_MAX_LENGTH} karakter`),
});

export const SocketSendInputSchema = SendMessageInputSchema.extend({
  receiverId: z.string().min(1),
});
