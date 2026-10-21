import { createContext, useContext } from "react";

export type ToastMessage = { title: string; action?: { label: string; onClick: () => void }; duration?: number };
export const ToastContext = createContext<((message: ToastMessage) => void) | null>(null);
export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("useToast requires ToastProvider");
  return notify;
}
