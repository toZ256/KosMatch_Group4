import { create } from 'zustand';

export interface ToastItem {
  id: number;
  type: 'sukses' | 'bahaya' | 'info';
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  push: (type: ToastItem['type'], message: string) => void;
  dismiss: (id: number) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (type, message) => {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useToastStore.getState().push('sukses', m),
  error: (m: string) => useToastStore.getState().push('bahaya', m),
  info: (m: string) => useToastStore.getState().push('info', m),
};
