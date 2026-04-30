import { Outlet } from "react-router-dom";

export function AppShell() {
  return (
    <div className="app-shell">
      <div className="app-frame">
        <Outlet />
      </div>
    </div>
  );
}
