const configuredMasterLoginPath = import.meta.env.VITE_MASTER_LOGIN_PATH?.trim();

// Obfuscated path for master login in production-like environments.
export const MASTER_LOGIN_PATH = configuredMasterLoginPath
  ? configuredMasterLoginPath.startsWith("/")
    ? configuredMasterLoginPath
    : `/${configuredMasterLoginPath}`
  : "/platform-access";

export const MASTER_LOGIN_ROUTE_PATH = MASTER_LOGIN_PATH.replace(/^\/+/, "");
