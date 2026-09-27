import React, { useEffect } from 'react';
import { create } from 'zustand';

interface ToastState {
  message: string | null;
  show: (m: string) => void;
  clear: () => void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (m) => set({ message: m }),
  clear: () => set({ message: null }),
}));

export function Toast() {
  const { message, clear } = useToast();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(clear, 3200);
    return () => clearTimeout(t);
  }, [message, clear]);
  if (!message) return null;
  return (
    <div className="toast" data-testid="toast">
      {message}
    </div>
  );
}
