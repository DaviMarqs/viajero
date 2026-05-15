import { Compass, Home, Map, User } from "lucide-react";
import { NavLink } from "react-router-dom";

export default function Sidebar() {
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex gap-2 text-lg py-3 px-3 rounded-lg transition-colors ${
      isActive ? "bg-blue-200 text-blue-700" : "text-gray-700 hover:bg-gray-200"
    }`;

  return (
    <div id="sidebar" className="py-6 px-6">
      <h1 className="pb-8 py-3 px-3">Logo</h1>

      <ul className="flex flex-col gap-3">
        <li>
          <NavLink to="/" className={linkClass}>
            <Home />
            <span>Home</span>
          </NavLink>
        </li>

        <li>
          <NavLink to="/explorar" className={linkClass}>
            <Compass />
            <span>Explorar</span>
          </NavLink>
        </li>

        <li>
          <NavLink to="/roteiros" className={linkClass}>
            <Map />
            <span>Roteiros</span>
          </NavLink>
        </li>

        <li>
          <NavLink to="/perfil" className={linkClass}>
            <User />
            <span>Perfil</span>
          </NavLink>
        </li>
      </ul>
    </div>
  );
}
