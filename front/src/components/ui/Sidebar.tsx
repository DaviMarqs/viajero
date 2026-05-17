import { useState } from "react";
import { Compass, Home, Map, User, LogOut } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/authContext";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex gap-3 items-center text-sm font-medium py-2.5 px-3 rounded-xl transition-colors ${
      isActive
        ? "bg-blue-50 text-blue-700"
        : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
    }`;

  return (
    <>
      <div
        id="sidebar"
        className="flex flex-col justify-between h-full py-6 px-4 border-r border-neutral-200"
      >
        <div className="flex flex-col gap-6">
          <div className="px-3">
            <span className="text-xl font-bold text-blue-700 tracking-tight">
              Viajero
            </span>
          </div>

          <ul className="flex flex-col gap-1">
            <li>
              <NavLink to="/" className={linkClass}>
                <Home className="size-4 shrink-0" />
                <span>Home</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/explorar" className={linkClass}>
                <Compass className="size-4 shrink-0" />
                <span>Explorar</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/roteiros" className={linkClass}>
                <Map className="size-4 shrink-0" />
                <span>Roteiros</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/perfil" className={linkClass}>
                <User className="size-4 shrink-0" />
                <span>Perfil</span>
              </NavLink>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="size-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-semibold shrink-0">
              {user?.first_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium text-neutral-900 truncate">
                {user?.display_name ?? "Usuário"}
              </span>
              <span className="text-xs text-neutral-400 truncate">
                {user?.email ?? ""}
              </span>
            </div>
          </div>

          <button
            onClick={() => setShowLogout(true)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-neutral-600 hover:bg-red-50 hover:text-red-600 transition-colors w-full"
          >
            <LogOut className="size-4 shrink-0" />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {showLogout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowLogout(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex flex-col gap-1.5">
              <h2 className="text-base font-semibold text-neutral-900">
                Sair da conta
              </h2>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Você será desconectado e precisará fazer login novamente para
                acessar seus roteiros.
              </p>
            </div>

            {/* Ações */}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowLogout(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-neutral-700 hover:bg-neutral-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
