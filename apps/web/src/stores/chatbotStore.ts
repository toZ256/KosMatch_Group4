import { create } from 'zustand';
import type { ChatbotResultItem } from '@kosmatch/shared';

export interface BotMessage {
  id: string;
  role: 'bot' | 'user';
  text: string;
  results?: ChatbotResultItem[];
  noResults?: boolean;
  destinationId?: string;
  isError?: boolean;
}

export const GREETING: BotMessage = {
  id: 'greeting',
  role: 'bot',
  text: 'Halo! Saya asisten KosMatch. Ceritakan kos seperti apa yang kamu cari. Contoh: Cari kos dekat Stasiun Sudirman, ojek di bawah 15rb, budget 3 juta.',
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
