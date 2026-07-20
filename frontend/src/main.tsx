import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        // Lỗi 401 để interceptor trong api.ts xử lý refresh token, không để React Query tự retry
        if (error?.response?.status === 401) return false;
        // Lỗi 429 (rate limit) cũng không nên retry dồn dập, tránh làm nặng thêm
        if (error?.response?.status === 429) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false, // tránh gọi lại API mỗi khi switch tab, giảm tải thêm
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
  