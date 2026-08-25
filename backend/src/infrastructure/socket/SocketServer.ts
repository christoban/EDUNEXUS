import type { Server as HttpServer } from "http";
import { Server, type Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { parse as parseCookie } from "cookie";
import type { AuthPayload } from '../http/middlewares/auth.ts';
import { prisma } from "@infrastructure/persistence/prisma/prisma.client";
import { PrismaMessagerieRepository } from "@infrastructure/persistence/prisma/PrismaMessagerieRepository";

let io: Server | null = null;

/**
 * Authentifie la connexion Socket.io via le même cookie access_token que les requêtes HTTP
 * (voir middleware/auth.ts) — sans quoi les rooms "user:{userId}" et "school:{schoolId}:role:{role}"
 * (utilisées par SocketNotificationService pour cibler une notification) ne sont jamais rejointes
 * et l'émission part dans le vide. Une connexion sans cookie valide reste tolérée (pas rejetée) :
 * l'existant `emitSmsDelivered` diffuse en global sans authentification, ce comportement est
 * préservé — l'authentification n'ajoute que la capacité de rejoindre des rooms ciblées.
 */
function authentifierSocket(socket: Socket): AuthPayload | null {
  try {
    const cookieHeader = socket.handshake.headers.cookie;
    if (!cookieHeader) return null;
    const cookies = parseCookie(cookieHeader);
    const token = cookies["access_token"];
    if (!token) return null;
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload;
    if (payload.tokenType !== "access") return null;
    return payload;
  } catch {
    return null;
  }
}

export const initSocket = (httpServer: HttpServer, origin?: string) => {
  io = new Server(httpServer, {
    cors: {
      origin: origin || true,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    const auth = authentifierSocket(socket);
    if (auth) {
      socket.join(`user:${auth.userId}`);
      socket.join(`school:${auth.schoolId}:role:${auth.role}`);
    }

    // Room jointe à la demande (pas à la connexion) — pas de coût de room pour des
    // conversations jamais ouvertes. Vérification d'appartenance AVANT le join : sans ça,
    // n'importe quel client connecté pourrait rejoindre n'importe quelle conversation en
    // devinant un ID et écouter les messages d'autrui.
    socket.on("conversation:join", async (conversationId: string, callback?: (ok: boolean) => void) => {
      if (!auth || typeof conversationId !== "string") { callback?.(false); return; }
      try {
        const messagerieRepository = new PrismaMessagerieRepository(prisma);
        await messagerieRepository.verifierAppartenanceConversation({
          conversationId,
          schoolId: auth.schoolId,
          userId: auth.userId,
          role: auth.role,
        });
        socket.join(`conversation:${conversationId}`);
        callback?.(true);
      } catch {
        callback?.(false);
      }
    });

    socket.on("conversation:leave", (conversationId: string) => {
      if (typeof conversationId === "string") socket.leave(`conversation:${conversationId}`);
    });
  });

  return io;
};

export const getIO = () => io;

export const emitSmsDelivered = (payload: {
  smsLogId?: string;
  msgId?: string;
  to?: string;
  status?: string;
}) => {
  if (!io) return;
  io.emit("sms_delivered", payload);
};
