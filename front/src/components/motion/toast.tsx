import { useState, type ReactNode } from "react";
import { Toast } from "radix-ui";
import { X } from "lucide-react";
import { ToastContext, type ToastMessage } from "./toast-context";

let nextId = 0;
export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<(ToastMessage & { id: number })[]>([]);
  return <ToastContext.Provider value={message => setMessages(current => [...current.slice(-2), { ...message, id: ++nextId }])}><Toast.Provider duration={6000} swipeDirection="right">{children}{messages.map(message => <Toast.Root type="background" className="motion-toast" key={message.id} duration={message.duration ?? 6000} onOpenChange={open => { if (!open) window.setTimeout(() => setMessages(current => current.filter(item => item.id !== message.id)), 240); }}><Toast.Title>{message.title}</Toast.Title>{message.action && <Toast.Action asChild altText={message.action.label}><button type="button" className="underline underline-offset-4" onClick={message.action.onClick}>{message.action.label}</button></Toast.Action>}<Toast.Close aria-label="Fechar aviso"><X size={16} aria-hidden="true" /></Toast.Close></Toast.Root>)}<Toast.Viewport className="motion-toast-viewport" label="Avisos" /></Toast.Provider></ToastContext.Provider>;
}
