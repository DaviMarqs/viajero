import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  useOutletContext,
  Navigate,
} from "react-router-dom";
import { useAuth } from "@/contexts/authContext";

import Login from "./pages/login/login";
import Register from "./pages/register/register";
import Onboard from "./pages/onboarding/onboarding";
import TravelPreferencesOnboarding from "./pages/travel-preferences-onboarding/travel-preferences-onboarding";
import Test from "./pages/tests/test";
import { Dashboard } from "./pages/dashboard/dashboard";
import DestinationPage from "./pages/destination/destination";

import "./index.css";
import ProfilePage from "./pages/user-profile/user";
import Recommendations from "./pages/recommendations/recommendations";
import Explorer from "./pages/explorer/explorer";
import Roteiros from "./pages/roteiros/roteiros";
import RoteiroCriacaoPage from "./pages/roteiros/roteiro-criacao";
import RoteiroDetalhePage from "./pages/roteiros/roteiro-detalhe";
import Sidebar from "./components/ui/Sidebar";

function PrivateRoute() {
  const { token, logout, isGuest, isAuthenticated } = useAuth();

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="hidden h-full w-64 shrink-0 lg:block">
        <Sidebar />
      </aside>
      <div className="lg:hidden">
        <Sidebar />
      </div>
      <main className="flex-1 overflow-y-auto pt-14 lg:pt-0">
        <Outlet context={{ token, logout, isGuest }} />
      </main>
    </div>
  );
}

function PublicRoute() {
  return <Outlet />;
}

function ProfilePageWrapper() {
  const { token, logout } = useOutletContext<{
    token: string;
    logout: () => void;
  }>();
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
          <Route path="/explorar" element={<Explorer />} />
          <Route path="/destinos/:id" element={<DestinationPage />} />
          <Route path="/onboard" element={<Onboard />} />
          <Route
            path="/onboard/preferências"
            element={<TravelPreferencesOnboarding />}
          />
          <Route path="/roteiros/:id" element={<RoteiroDetalhePage />} />
          <Route path="/roteiros/criacao" element={<RoteiroCriacaoPage />} />
          <Route path="/roteiros" element={<Roteiros />} />
          <Route path="/perfil" element={<ProfilePageWrapper />} />
          <Route path="/test" element={<Test />} />
          <Route path="/recomendações" element={<Recommendations />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
