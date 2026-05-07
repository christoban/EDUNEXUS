import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from "sonner";
import "./index.css";
import { RouterProvider } from "react-router";
import { router } from "@/pages/routes/router.tsx";
import { AuthProvider } from "@/hooks/AuthProvider";
import { MasterAuthProvider } from "@/hooks/useMasterAuth";
import { ThemeProvider } from "@/components/provider/theme";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
    <StrictMode>
      <MasterAuthProvider>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster />
        </AuthProvider>
      </MasterAuthProvider>
    </StrictMode>
  </ThemeProvider>,
);
