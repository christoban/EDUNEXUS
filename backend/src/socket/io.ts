import type { Server as HttpServer } from "http";
import { Server } from "socket.io";

let io: Server | null = null;

export const initSocket = (httpServer: HttpServer, origin?: string) => {
  io = new Server(httpServer, {
    cors: {
      origin: origin || true,
      credentials: true,
    },
  });

  io.on("connection", () => {
    // Keep default broadcast-style behavior for SMS status updates.
  });

  return io;
};

export const getIO = () => io;

export const emitSmsDelivered = (payload: { msgId: string; smsLogId?: string }) => {
  if (!io) return;
  io.emit("sms_delivered", payload);
};
