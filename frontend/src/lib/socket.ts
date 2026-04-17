import { io, type Socket } from "socket.io-client";

let socketInstance: Socket | null = null;

const resolveSocketBaseUrl = () => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

  try {
    const url = new URL(apiBaseUrl);
    url.pathname = url.pathname.replace(/\/api\/?$/, "");
    return url.toString().replace(/\/$/, "");
  } catch {
    return "http://localhost:5000";
  }
};

export const getSocketClient = () => {
  if (socketInstance) {
    return socketInstance;
  }

  socketInstance = io(resolveSocketBaseUrl(), {
    withCredentials: true,
    transports: ["websocket", "polling"],
  });

  return socketInstance;
};

export const disconnectSocketClient = () => {
  if (!socketInstance) return;
  socketInstance.disconnect();
  socketInstance = null;
};
