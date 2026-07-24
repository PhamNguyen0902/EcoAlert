import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AppToaster } from "./components/ui/app-toaster";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.response?.status === 401) return false;
        if (error?.response?.status === 429) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <App />
              <AppToaster />
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);