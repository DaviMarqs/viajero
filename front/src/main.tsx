import { createRoot } from "react-dom/client";
import "@fontsource-variable/geist";
import "@fontsource-variable/inter";
import "./index.css";
import App from "./App.tsx";

import { AuthProvider } from "@/contexts/authContext";
import { CurrencyProvider } from "@/contexts/currencyContext";
import { ToastProvider } from "@/components/motion/toast";

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <CurrencyProvider>
      <ToastProvider><App /></ToastProvider>
    </CurrencyProvider>
  </AuthProvider>,
);
