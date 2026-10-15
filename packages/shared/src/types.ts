import type { z } from 'zod';
import type {
  BookmarkSchema,
  ChatHistorySchema,
  ChatParamsSchema,
  CommuteEstimateSchema,
  DestinationSchema,
  KosFormSchema,
  KosSchema,
  LoginInputSchema,
  PublicUserSchema,
  RegisterInputSchema,
  RoleSchema,
  TipeKosSchema,
  TransportModeSchema,
  UserSchema,
} from './schemas';

export type Role = z.infer<typeof RoleSchema>;
export type TipeKos = z.infer<typeof TipeKosSchema>;
export type TransportMode = z.infer<typeof TransportModeSchema>;
export type User = z.infer<typeof UserSchema>;
export type PublicUser = z.infer<typeof PublicUserSchema>;
export type Kos = z.infer<typeof KosSchema>;
export type ChatHistory = z.infer<typeof ChatHistorySchema>;
export type Bookmark = z.infer<typeof BookmarkSchema>;
export type Destination = z.infer<typeof DestinationSchema>;
export type CommuteEstimate = z.infer<typeof CommuteEstimateSchema>;
export type ChatParams = z.infer<typeof ChatParamsSchema>;
export type RegisterInput = z.infer<typeof RegisterInputSchema>;
export type LoginInput = z.infer<typeof LoginInputSchema>;
export type KosFormInput = z.input<typeof KosFormSchema>;
export type KosFormOutput = z.output<typeof KosFormSchema>;

/* ---------------- API response shapes ---------------- */

export interface ApiSuccess<T> {
  ok: true;
  data: T;
}
export interface ApiFailure {
  ok: false;
  error: { code: ErrorCode; message: string };
}
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INTERNAL';

export interface AuthResult {
  token: string;
  user: PublicUser;
}

export interface KosWithCommute extends Kos {
  commute?: CommuteEstimate[];
}

export interface ChatbotResultItem {
  kos: Kos;
  commute: CommuteEstimate[];
}

export interface ChatbotResponse {
  reply: string;
  params: ChatParams;
  results: ChatbotResultItem[];
  noResults: boolean;
}

export interface ConversationSummary {
  otherUser: PublicUser;
  last: ChatHistory;
}

export interface HealthResponse {
  status: 'ok';
  mode: { ai: 'mock'; data: 'memory' };
}
