import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useAuth } from "@/contexts/authContext";
import Sidebar from "@/components/ui/sidebar";

import Login from "./pages/login/login";
import Register from "./pages/register/register";
import Onboard from "./pages/onboarding/onboarding";
import Test from "./pages/tests/test";
import { Dashboard } from "./pages/dashboard/dashboard";
import DestinationPage from "./pages/destination/destination";

import "./index.css";

// Rota protegida — redireciona pro login se não autenticado
function PrivateRoute() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-64 shrink-0 h-full">
        <Sidebar />
      </aside>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}

function PublicRoute() {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <Outlet />;
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
          <Route path="/destinos/:slug" element={<DestinationPage />} />
          <Route
            path="/roteiros"
            element={<div className="p-8">Roteiros</div>}
          />
          <Route path="/perfil" element={<div className="p-8">Perfil</div>} />
          <Route path="/test" element={<Test />} />
        </Route>

        <Route path="/onboard" element={<Onboard />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
