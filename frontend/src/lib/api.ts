import axios from "axios";
import { MASTER_LOGIN_PATH } from "@/lib/masterRoutes";

export const api = axios.create({
  baseURL: "/api", // ⭐ IMPORTANT: plus de localhost ici
  withCredentials: true,
  timeout: 15000,
});

const RETRY_COUNT = 2;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  const masterToken = localStorage.getItem("master_token");
  
  if (masterToken && config.url?.includes("/master")) {
    config.headers.Authorization = `Bearer ${masterToken}`;
  } else if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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

  const publicOnboardingPaths = ["/onboarding/school", "/onboarding/join", "/onboarding/activate"];
  const isOnboardingPage = publicOnboardingPaths.some((path) => 
    window.location.pathname.startsWith(path)
  );

  if (isOnboardingPage) {
    return Promise.reject(error);
  }

  const PUBLIC_PATHS = [
    "/",
    "/login",
    "/onboarding/school",
    "/onboarding/join",
    "/onboarding/activate",
    "/master",
  ];

    const isPublicPath = (pathname: string) => {
      return PUBLIC_PATHS.some(
        (publicPath) =>
          pathname === publicPath || pathname.startsWith(publicPath + "/")
      );
    };

    if (error.response?.status === 401 || isNetworkError) {
      const isMasterPage =
        window.location.pathname.startsWith("/master") ||
        window.location.pathname.startsWith(MASTER_LOGIN_PATH);

      if (isPublicPath(window.location.pathname)) {
        return Promise.reject(error);
      }

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