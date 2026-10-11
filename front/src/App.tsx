import { lazy, Suspense } from "react";
import { PageSkeleton } from "./components/ui/feedback";
import {
  BrowserRouter,
  Routes,
  Route,
  Outlet,
  useOutletContext,
  Navigate,
} from "react-router-dom";
import { useAuth } from "@/contexts/authContext";

const Login = lazy(() => import("./pages/login/login"));
const Register = lazy(() => import("./pages/register/register"));
const Onboard = lazy(() => import("./pages/onboarding/onboarding"));
const TravelPreferencesOnboarding = lazy(
  () =>
    import("./pages/travel-preferences-onboarding/travel-preferences-onboarding"),
);
const Test = lazy(() => import("./pages/tests/test"));
const Dashboard = lazy(() =>
  import("./pages/dashboard/dashboard").then((module) => ({
    default: module.Dashboard,
  })),
);
const DestinationPage = lazy(() => import("./pages/destination/destination"));
const DestinationsPage = lazy(() => import("./pages/destination/destinations"));

import "./index.css";
const ProfilePage = lazy(() => import("./pages/user-profile/user"));
const Recommendations = lazy(
  () => import("./pages/recommendations/recommendations"),
);
const Explorer = lazy(() => import("./pages/explorer/explorer"));
const Favorites = lazy(() => import("./pages/favorites/favorites"));
const Roteiros = lazy(() => import("./pages/roteiros/roteiros"));
const RoteiroCriacaoPage = lazy(
  () => import("./pages/roteiros/roteiro-criacao"),
);
const RoteiroDetalhePage = lazy(
  () => import("./pages/roteiros/roteiro-detalhe"),
);
import Sidebar from "./components/ui/Sidebar";
import { CurrencyPicker } from "./components/ui/currency-picker";

function PrivateRoute() {
  const { token, logout, isGuest, isAuthenticated } = useAuth();

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-dvh">
      <a href="#main-content" className="skip-link">
        Pular para o conteúdo
      </a>
      <Sidebar />
      <main
        id="main-content"
        tabIndex={-1}
        className="app-main relative min-w-0 flex-1 pt-16 lg:pt-0"
      >
        <div className="platform-toolbar hidden lg:flex"><CurrencyPicker /></div>
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
      <Suspense
        fallback={<PageSkeleton />}
      >
        <Routes>
          <Route element={<PublicRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          <Route element={<PrivateRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/explorar" element={<Explorer />} />
            <Route path="/favoritos" element={<Favorites />} />
            <Route path="/destinos/:id" element={<DestinationPage />} />
            <Route path="/destinos" element={<DestinationsPage />} />
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
