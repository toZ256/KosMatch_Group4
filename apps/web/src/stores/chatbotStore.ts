import { create } from 'zustand';
import type { AgentAction, ChatbotResultItem, ChatParams } from '@kosmatch/shared';

export interface BotMessage {
  id: string;
  role: 'bot' | 'user';
  text: string;
  params?: ChatParams;
  results?: ChatbotResultItem[];
  noResults?: boolean;
  destinationId?: string;
  isError?: boolean;
  isFallback?: boolean;
  fallbackReason?: string;
  unsupportedRequests?: string[];
  actions?: AgentAction[];
  guardrailNotice?: string;
  guardrailBlocked?: boolean;
  aiMode?: 'gemini' | 'mock';
}

export const GREETING: BotMessage = {
  id: 'greeting',
  role: 'bot',
  text: 'Halo Kak! Kenalin, aku KosMatch AI yang siap bantu carikan kos paling pas buat kamu 😊\n\nLagi cari kos dekat kampus, kantor, atau daerah mana nih? Boleh ceritain juga kisaran budget, tipe kos (putra/putri/campur), atau kalau mau langsung bandingin kos & chat pemiliknya juga bisa banget!',
};

interface ChatbotState {
  open: boolean;
  messages: BotMessage[];
  pending: boolean;
  openPanel: () => void;
  closePanel: () => void;
  addMessage: (m: BotMessage) => void;
  setPending: (p: boolean) => void;
  reset: () => void;
}

export const useChatbotStore = create<ChatbotState>((set) => ({
  open: false,
  messages: [GREETING],
  pending: false,
  openPanel: () => set({ open: true }),
  closePanel: () => set({ open: false }),
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
  setPending: (pending) => set({ pending }),
  reset: () => set({ messages: [GREETING], pending: false }),
}));
