import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AppShell } from "../components/layout/AppShell";
import { DestinationDetailPage } from "../pages/DestinationDetailPage";
import { DestinationDiscoveryPage } from "../pages/DestinationDiscoveryPage";
import { FavoritesPage } from "../pages/FavoritesPage";
import { FirecrawlAdminPage } from "../pages/FirecrawlAdminPage";
import { GenerateItineraryPage } from "../pages/GenerateItineraryPage";
import { ItineraryDetailPage } from "../pages/ItineraryDetailPage";
import { ItineraryTimelinePage } from "../pages/ItineraryTimelinePage";
import { LoginPage } from "../pages/LoginPage";
import { ProfileSetupPage } from "../pages/ProfileSetupPage";
import { RegisterPage } from "../pages/RegisterPage";
import { ReviewSharePage } from "../pages/ReviewSharePage";
import { TravelerDNASetupPage } from "../pages/TravelerDNASetupPage";
import { TripPreferencesPage } from "../pages/TripPreferencesPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<DestinationDiscoveryPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/profile" element={<ProfileSetupPage />} />
          <Route path="/traveler-dna" element={<TravelerDNASetupPage />} />
          <Route path="/trip-preferences" element={<TripPreferencesPage />} />
          <Route path="/destinations/:id" element={<DestinationDetailPage />} />
          <Route path="/generate" element={<GenerateItineraryPage />} />
          <Route path="/itineraries/:id" element={<ItineraryDetailPage />} />
          <Route path="/itineraries/:id/timeline" element={<ItineraryTimelinePage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/reviews-share/:id" element={<ReviewSharePage />} />
          <Route path="/admin/firecrawl" element={<FirecrawlAdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

