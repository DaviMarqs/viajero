import { Dialog } from "radix-ui";
import { X } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "../ui/button";

export function Sheet({ open, onOpenChange, trigger, title, children, onCloseAutoFocus }: { open: boolean; onOpenChange: (open: boolean) => void; trigger: ReactNode; title: string; children: ReactNode; onCloseAutoFocus?: ComponentProps<typeof Dialog.Content>["onCloseAutoFocus"] }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Trigger asChild>{trigger}</Dialog.Trigger><Dialog.Portal><Dialog.Overlay className="motion-sheet-backdrop" /><Dialog.Content className="motion-sheet" aria-describedby={undefined} onCloseAutoFocus={onCloseAutoFocus}><div className="flex items-center justify-between gap-4"><Dialog.Title className="section-title">{title}</Dialog.Title><Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="Fechar"><X aria-hidden="true" /></Button></Dialog.Close></div>{children}</Dialog.Content></Dialog.Portal></Dialog.Root>;
}
