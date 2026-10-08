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
      <ul className="flex flex-col gap-1.5">{links.map(({ to, label, icon: Icon }) => <li key={to}>
        <NavLink to={to} end={to === "/"} onClick={() => setMobileOpen(false)} className={({ isActive }) => cn("flex min-h-12 items-center gap-3 rounded-control px-3 py-3 text-sm font-medium transition-colors", isActive ? "bg-secondary text-primary" : "text-strong hover:bg-surface hover:text-foreground")}>
          <Icon aria-hidden="true" className="size-5" />{label}
        </NavLink>
      </li>)}
      </ul>
    </nav>;
  }
  function footer() {
    return <div className="space-y-3 border-t border-border pt-5">
      <Link to="/perfil" className="flex min-w-0 items-center gap-3 rounded-control px-2 py-2 hover:bg-surface">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-surface text-sm font-semibold text-primary">
          {user?.avatar_url ? <img src={user.avatar_url} alt="" className="size-full object-cover" /> : (user?.display_name || 'V').slice(0, 1).toUpperCase()}
        </span>
        <span className="min-w-0"><span className="block truncate text-sm font-medium">{user?.display_name}</span><span className="text-xs text-muted-foreground">Meu perfil</span></span>
      </Link>
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
    <aside className="hidden h-dvh w-sidebar shrink-0 flex-col justify-between gap-8 overflow-y-auto border-r border-border bg-muted/60 p-5 lg:sticky lg:top-0 lg:flex">
      <div className="space-y-8">
        <Link to="/" className="block px-3 py-2 font-display text-[28px] font-semibold tracking-tight text-primary">Viajero</Link>{navigation()}
      </div>{footer()}
    </aside>
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
      <Link to="/" className="font-display text-2xl font-semibold tracking-tight text-primary">Viajero</Link>
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
