import type { Application } from 'express';
import { prisma } from '@infrastructure/persistence/prisma/prisma.client';
import { creerContainer } from '@infrastructure/config/container';
import { DevController } from '@infrastructure/http/controllers/DevController';
import { creerDevRoutes } from '@infrastructure/http/routes/dev.routes';
import { errorHandler } from '@infrastructure/http/middlewares/errorHandler';
import { registerRegistrationsRoutes } from './registrations';
import { registerListsRoutes } from './lists';


type Container = ReturnType<typeof creerContainer>;

export function registerInfra(app: Application, _prisma: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  registerInfraRoutes(app, _prisma, container);
}

export function registerInfraRoutes(app: Application, prismaParam: typeof prisma = prisma, container: Container = creerContainer() as Container): void {
  const p = prismaParam ?? prisma;
  const c = container;

  registerRegistrationsRoutes(app, p, c);
  registerListsRoutes(app, p, c);

  // ── Routes dev — DÉSACTIVÉES en production ──────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const devController = new DevController(p);
    app.use('/api/v2/dev', creerDevRoutes(devController));
    console.log('🔧 Routes dev montées sur /api/v2/dev (NODE_ENV:', process.env.NODE_ENV, ')');
  }

  app.use(errorHandler);
}
