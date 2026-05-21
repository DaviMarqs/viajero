import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useAuth } from "@/contexts/authContext";
import Sidebar from "@/components/ui/sidebar";
import { useOutletContext } from "react-router-dom";


import Login from "./pages/login/login";
import Register from "./pages/register/register";
import Onboard from "./pages/onboarding/onboarding";
import Test from "./pages/tests/test";
import { Dashboard } from "./pages/dashboard/dashboard";
import DestinationPage from "./pages/destination/destination";

import "./index.css";
import ProfilePage from "./pages/user-profile/user";
import Recommendations from "./pages/recommendations/recommendations";

function PrivateRoute() {
  const { isAuthenticated, token, logout } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden lg:block w-64 shrink-0 h-full">
        <Sidebar />
      </aside>
      <div className="lg:hidden">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <Outlet context={{ token, logout }} />
      </main>
    </div>
  );
}

function PublicRoute() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
}

function ProfilePageWrapper() {
  const { token, logout } = useOutletContext<{ token: string; logout: () => void }>();
  return <ProfilePage token={token} onLogout={logout} />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        <Route element={<PrivateRoute />}>
          <Route path="/" element={<Dashboard />} />
          <Route
            path="/explorar"
            element={<div className="p-8">Explorar</div>}
          />
          <Route path="/destinos/:id" element={<DestinationPage />} />
          <Route
            path="/roteiros"
            element={<div className="p-8">Roteiros</div>}
          />
          <Route path="/perfil" element={<ProfilePageWrapper />} />
          <Route path="/test" element={<Test />} />

          <Route path="/recomendacoes" element={<Recommendations />} />
        </Route>

        <Route path="/onboard" element={<Onboard />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
