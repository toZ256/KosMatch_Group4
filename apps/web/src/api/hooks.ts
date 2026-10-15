import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AuthResult,
  Bookmark,
  ChatHistory,
  ChatbotResponse,
  CommuteEstimate,
  ConversationSummary,
  Destination,
  HealthResponse,
  Kos,
  KosFormOutput,
  KosWithCommute,
  PublicUser,
} from '@kosmatch/shared';
import { del, errorMessage, get, post, put } from './client';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../stores/toastStore';

export const qk = {
  health: ['health'] as const,
  destinations: ['destinations'] as const,
  kosList: (params: object) => ['kos', 'list', params] as const,
  kos: (id: string, destinationId?: string) => ['kos', 'detail', id, destinationId ?? null] as const,
  bookmarks: ['bookmarks'] as const,
  conversations: ['conversations'] as const,
  messages: (otherId: string) => ['messages', otherId] as const,
  user: (id: string) => ['user', id] as const,
  ownerKos: ['owner', 'kos'] as const,
};

export const useHealth = () => useQuery({ queryKey: qk.health, queryFn: () => get<HealthResponse>('/health'), retry: false });

export const useDestinations = () =>
  useQuery({ queryKey: qk.destinations, queryFn: () => get<Destination[]>('/destinations'), staleTime: Infinity });

export interface KosSearchParams {
  q?: string;
  maxPrice?: number;
  tipe?: string;
  destinationId?: string;
}

export const useKosList = (params: KosSearchParams) =>
  useQuery({ queryKey: qk.kosList(params), queryFn: () => get<KosWithCommute[]>('/kos', { ...params }) });

export const useKos = (id: string, destinationId?: string) =>
  useQuery({
    queryKey: qk.kos(id, destinationId),
    queryFn: () => get<KosWithCommute>(`/kos/${id}`, destinationId ? { destinationId } : undefined),
    retry: false,
  });

export const useCommute = (kosId: string, destinationId?: string) =>
  useQuery({
    queryKey: ['commute', kosId, destinationId],
    queryFn: () => get<CommuteEstimate[]>('/commute', { kosId, destinationId }),
    enabled: !!destinationId,
  });

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (input: { email: string; password: string }) => post<AuthResult>('/auth/login', input),
    onSuccess: (r) => setSession(r.token, r.user),
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (input: { nama: string; email: string; password: string; role: 'tenant' | 'owner' }) =>
      post<AuthResult>('/auth/register', input),
    onSuccess: (r) => setSession(r.token, r.user),
  });
}

export const useBookmarks = () => {
  const token = useAuthStore((s) => s.token);
  return useQuery({ queryKey: qk.bookmarks, queryFn: () => get<Kos[]>('/bookmarks'), enabled: !!token });
};

/** Toggle with optimistic update, rollback on failure and a toast either way. */
export function useToggleBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kos, saved }: { kos: Kos; saved: boolean }) => {
      if (saved) await del(`/bookmarks/${kos.id}`);
      else await post<Bookmark>('/bookmarks', { kosId: kos.id });
    },
    onMutate: async ({ kos, saved }) => {
      await qc.cancelQueries({ queryKey: qk.bookmarks });
      const previous = qc.getQueryData<Kos[]>(qk.bookmarks);
      qc.setQueryData<Kos[]>(qk.bookmarks, (old = []) =>
        saved ? old.filter((k) => k.id !== kos.id) : [...old, kos],
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      qc.setQueryData(qk.bookmarks, ctx?.previous);
      toast.error(errorMessage(err));
    },
    onSuccess: (_d, { saved }) => toast.success(saved ? 'Dihapus dari tersimpan' : 'Disimpan'),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.bookmarks }),
  });
}

export const useChatbotAsk = () =>
  useMutation({ mutationFn: (message: string) => post<ChatbotResponse>('/chatbot', { message }) });

export const useConversations = () => {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: qk.conversations,
    queryFn: () => get<ConversationSummary[]>('/chats/conversations'),
    enabled: !!token,
  });
};

export const useMessages = (otherId?: string) =>
  useQuery({
    queryKey: qk.messages(otherId ?? ''),
    queryFn: () => get<ChatHistory[]>(`/chats/${otherId}`),
    enabled: !!otherId,
    staleTime: 0,
  });

export const usePublicUser = (id?: string) =>
  useQuery({ queryKey: qk.user(id ?? ''), queryFn: () => get<PublicUser>(`/users/${id}`), enabled: !!id, retry: false });

export const useOwnerKos = () => useQuery({ queryKey: qk.ownerKos, queryFn: () => get<Kos[]>('/owner/kos') });

export function useSaveOwnerKos(id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: KosFormOutput) => (id ? put<Kos>(`/owner/kos/${id}`, input) : post<Kos>('/owner/kos', input)),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.ownerKos });
      void qc.invalidateQueries({ queryKey: ['kos'] });
    },
  });
}

export function useDeleteOwnerKos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`/owner/kos/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.ownerKos });
      void qc.invalidateQueries({ queryKey: ['kos'] });
      void qc.invalidateQueries({ queryKey: qk.bookmarks });
    },
  });
}
