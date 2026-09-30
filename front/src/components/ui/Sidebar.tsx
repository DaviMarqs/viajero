import { useState } from "react";
import { NavLink, Link } from "react-router-dom";
import { Compass, Home, Map, User, TrendingUp, Menu, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/authContext";
import { Button } from "./button";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger, DialogClose } from "./dialog";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Home", icon: Home },
  { to: "/roteiros", label: "Roteiros", icon: Map },
  { to: "/explorar", label: "Explorar", icon: Compass },
  { to: "/recomendações", label: "Recomendações", icon: TrendingUp },
  { to: "/perfil", label: "Perfil", icon: User },
];
export default function Sidebar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  function navigation() {
    return <nav aria-label="Navegação principal">
      <ul className="flex flex-col gap-3">{links.map(({ to, label, icon: Icon }) => <li key={to}>
        <NavLink to={to} end={to === "/"} onClick={() => setMobileOpen(false)} className={({ isActive }) => cn("flex min-h-11 items-center gap-2 rounded-control px-2 py-2 text-base transition-colors hover:bg-surface", isActive && "bg-surface font-medium shadow-control")}>
          <Icon aria-hidden="true" className="size-4.5" />{label}
        </NavLink>
      </li>)}
      </ul>
    </nav>;
  }
  function footer() {
    return <div className="space-y-3 border-t border-border pt-4">
      <p className="truncate text-sm text-muted-foreground">{user?.display_name}
      </p>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" className="w-full justify-start">
            <LogOut aria-hidden="true" />Sair</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Sair da conta?</DialogTitle>
          <DialogDescription>Seus roteiros salvos continuarão disponíveis quando você entrar novamente.</DialogDescription>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={logout}>Sair da conta</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>;
  }
  return <>
    <aside className="hidden h-dvh w-sidebar shrink-0 flex-col justify-between gap-8 overflow-y-auto border-r border-border bg-background p-6 lg:sticky lg:top-0 lg:flex">
      <div className="space-y-8">
        <Link to="/" className="block font-display text-[32px] font-semibold">Viajero</Link>{navigation()}
      </div>{footer()}
    </aside>
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
      <Link to="/" className="font-display text-2xl font-semibold">Viajero</Link>
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Abrir navegação">
            <Menu />
          </Button>
        </DialogTrigger>
        <DialogContent className="inset-y-0 left-0 h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none bg-background p-6 sm:max-w-72">
          <DialogTitle className="font-display text-2xl">Viajero</DialogTitle>
          <DialogDescription className="sr-only">Acesse as páginas da sua viagem.</DialogDescription>{navigation()}
          <div className="mt-auto">{footer()}
          </div>
        </DialogContent>
      </Dialog>
    </header>
  </>;
}
