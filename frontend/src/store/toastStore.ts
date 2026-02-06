/** Toast notifications for API errors and user feedback. */
import { create } from 'zustand';

export type ToastType = 'error' | 'success' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  retry?: () => void;
}

interface ToastState {
  toasts: Toast[];
  add: (message: string, type?: ToastType, retry?: () => void) => void;
  dismiss: (id: string) => void;
}

let idCounter = 0;

export const toastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (message, type = 'error', retry) => {
    const id = `toast-${++idCounter}`;
    set((s) => ({
      toasts: [...s.toasts, { id, message, type, retry }].slice(-5),
    }));
    if (type === 'error' || type === 'info') {
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 6000);
    }
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
