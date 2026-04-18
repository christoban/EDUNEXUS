import axios from "axios";
import { MASTER_LOGIN_PATH } from "@/lib/masterRoutes";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  withCredentials: true,
  timeout: 15000,
});

const RETRY_COUNT = 2;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Add token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error?.config as any;
    const isNetworkError = !error?.response;
    const isServerError = Number(error?.response?.status) >= 500;

    if (config && (isNetworkError || isServerError)) {
      config.__retryCount = config.__retryCount || 0;

      if (config.__retryCount < RETRY_COUNT) {
        config.__retryCount += 1;
        await wait(300 * config.__retryCount);
        return api.request(config);
      }
    }

    if (error.response?.status === 401) {
      // Token expired or invalid. Avoid hard-reload loop if already on the right login page.
      const isMasterPage =
        window.location.pathname.startsWith("/master") ||
        window.location.pathname.startsWith(MASTER_LOGIN_PATH);

      if (isMasterPage) {
        if (!window.location.pathname.startsWith(MASTER_LOGIN_PATH)) {
          window.location.replace(MASTER_LOGIN_PATH);
        }
      } else {
        localStorage.removeItem("token");
        if (window.location.pathname !== "/login") {
          window.location.replace("/login");
        }
      }
    }
    return Promise.reject(error);
  }
);
