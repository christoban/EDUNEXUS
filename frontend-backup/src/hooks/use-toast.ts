import { useState, useCallback } from "react";

export interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
}

export const useToast = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback(
    ({
      title,
      description,
      variant = "default",
      duration = 3000,
    }: Omit<Toast, "id">) => {
      const id = Math.random().toString(36).substr(2, 9);

      setToasts((prev) => [...prev, { id, title, description, variant, duration }]);

      // Auto-remove after duration
      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }

      return { id };
    },
    []
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toast, toasts, dismissToast };
};
