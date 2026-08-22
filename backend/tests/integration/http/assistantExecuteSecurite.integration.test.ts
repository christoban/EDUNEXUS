/**
 * Test d'intégration — garde-fous de `/assistant/execute` face à un modèle ADVERSE.
 *
 * POURQUOI un modèle simulé ici, alors que le reste de la suite évite les mocks : ce n'est pas
 * pour la couverture, c'est parce que le mock donne un test de sécurité STRICTEMENT MEILLEUR.
 *
 * Les garde-fous de `execute` (double-vérification RBAC serveur, détection de paramètre
 * halluciné, mise en attente obligatoire des actions destructives) ne se déclenchent que face à
 * une sortie de modèle bien précise. Avec le vrai Groq, on ne peut pas PROVOQUER ces sorties de
 * façon fiable : on ne testerait que le cas heureux — c'est-à-dire exactement le cas où les
 * garde-fous ne servent à rien. En pilotant la sortie du modèle, on soumet le serveur au pire
 * comportement plausible :
 *   - un modèle qui appelle un outil interdit au rôle de l'utilisateur (injection de prompt
 *     réussie, modèle compromis, ou simple erreur de sélection d'outil) ;
 *   - un modèle qui invente la valeur d'un paramètre que l'utilisateur n'a jamais fournie ;
 *   - un modèle qui déclenche une suppression sans passer par la confirmation.
 *
 * Autrement dit : on ne teste pas le modèle, on teste que le serveur ne lui fait JAMAIS confiance.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import type { PrismaClient } from '@prisma/client';
import { AssistantController } from '../../../src/infrastructure/http/controllers/AssistantController.ts';
import { buildAdminActionCatalog } from '@application/assistant/adminActionCatalog';
import { requireAuth } from '../../../src/middleware/auth.ts';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';
import { CreerClasseUseCase } from '@application/class/CreerClasseUseCase';
import { SupprimerClasseUseCase } from '@application/class/SupprimerClasseUseCase';
import { PrismaClasseRepository } from '@infrastructure/persistence/prisma/PrismaClasseRepository';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET non défini — requis dans .env.test pour ce test.');
}

/** Sortie de modèle simulée : les tool calls que le modèle « décide » d'émettre. */
type ToolCallSimule = { toolName: string; input: Record<string, unknown> };
let sortieModele: { text: string; toolCalls: ToolCallSimule[] } = { text: '', toolCalls: [] };

/** Remplace `generateText` : ignore le prompt, renvoie la sortie pilotée par le test. */
const modeleSimule = (async () => ({
  text: sortieModele.text,
  toolCalls: sortieModele.toolCalls.map(tc => ({ toolName: tc.toolName, input: tc.input })),
})) as unknown as typeof import('ai').generateText;

let server: Server;
let baseUrl: string;
let schoolId: string;
let adminToken: string;
let studentToken: string;
let academicYearId: string;

const auth = (token: string) => ({ Cookie: `access_token=${token}`, 'Content-Type': 'application/json' });

async function demander(token: string, message = 'peu importe, la sortie du modèle est pilotée') {
  const res = await fetch(`${baseUrl}/assistant/execute`, {
    method: 'POST', headers: auth(token), body: JSON.stringify({ message }),
  });
  return {
    res,
    body: await res.json() as {
      success: boolean; type?: string; response?: string;
      executed?: { error?: string; actionType?: string; label?: string }[];
      pending?: { pendingActionId: string; actionType: string; summary: string }[];
    },
  };
}

async function attendreAudit<T>(lecture: () => Promise<T | null>, timeoutMs = 3000): Promise<T | null> {
  const debut = Date.now();
  while (Date.now() - debut < timeoutMs) {
    const r = await lecture();
    if (r) return r;
    await new Promise(res => setTimeout(res, 25));
  }
  return null;
}

beforeAll(async () => {
  const school = await creerEcoleTest(prismaTest, 'assistExec');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN', suffix: 'exec-admin' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );
  const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'exec-student' });
  studentToken = jwt.sign(
    { userId: student.id, schoolId, role: 'STUDENT', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: true, status: 'ACTIVE' },
  });
  academicYearId = annee.id;

  // Catalogue Admin réel, avec les seules dépendances qu'exercent nos scénarios.
  const classeRepo = new PrismaClasseRepository(prismaTest);
  const catalog = buildAdminActionCatalog({
    creerClasse: new CreerClasseUseCase(classeRepo),
    supprimerClasse: new SupprimerClasseUseCase(classeRepo),
  } as unknown as Parameters<typeof buildAdminActionCatalog>[0]);

  const controller = new AssistantController(prismaTest as unknown as PrismaClient, catalog, modeleSimule);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.post('/api/v2/assistant/execute', requireAuth, controller.execute);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.assistantActionLog.deleteMany({ where: { schoolId } });
  await prismaTest.aIActionAuditLog.deleteMany({ where: { schoolId } });
  await prismaTest.assistantConversationTurn.deleteMany({ where: { schoolId } });
  await prismaTest.assistantHelpQueryLog.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('execute — le serveur ne fait jamais confiance au modèle', () => {
  it("REFUSE un outil interdit au rôle, même si le modèle l'appelle explicitement", async () => {
    // Scénario : injection de prompt réussie ou modèle compromis — un ÉLÈVE obtient du modèle
    // qu'il appelle une action du catalogue Admin. Impossible à provoquer avec le vrai modèle.
    sortieModele = {
      text: '',
      toolCalls: [{ toolName: 'supprimer_classe', input: { className: 'Terminale C' } }],
    };

    const { body } = await demander(studentToken);

    // L'action n'est pas exécutée : elle ressort en erreur, jamais en succès.
    expect(body.executed?.[0]?.error).toContain('non autorisée');
    expect(body.pending ?? []).toHaveLength(0);

    // Et le refus est tracé avec sa raison.
    const audit = await attendreAudit(() => prismaTest.aIActionAuditLog.findFirst({
      where: { schoolId, actionName: 'supprimer_classe', outcome: 'REFUSE' },
      orderBy: { timestamp: 'desc' },
    }));
    expect(audit?.refusalReason).toBe('action_hors_catalogue_autorise');
  });

  it("REFUSE une action inconnue du catalogue (outil inventé par le modèle)", async () => {
    sortieModele = {
      text: '',
      toolCalls: [{ toolName: 'supprimer_tous_les_eleves', input: {} }],
    };

    const { body } = await demander(adminToken);
    expect(body.executed?.[0]?.error).toContain('non autorisée');
  });

  it("BLOQUE un paramètre halluciné : le modèle recopie la description au lieu d'une vraie valeur", async () => {
    // `creer_classe.name` est décrit « Nom complet de la classe, ex. "4e D", "Terminale C" ».
    // Un modèle qui n'a pas l'information recopie cette description comme valeur — comportement
    // réellement observé chez Groq/Llama. Rien ne doit être créé : on redemande l'information.
    sortieModele = {
      text: '',
      toolCalls: [{
        toolName: 'creer_classe',
        input: { name: 'Nom complet de la classe, ex. "4e D", "Terminale C"' },
      }],
    };

    const { body } = await demander(adminToken);

    expect(body.type).toBe('message');
    expect(body.response).toContain('Il me manque une information');
    // AUCUNE classe créée à partir d'une valeur inventée.
    expect(await prismaTest.class.count({ where: { schoolId } })).toBe(0);

    const audit = await attendreAudit(() => prismaTest.aIActionAuditLog.findFirst({
      where: { schoolId, actionName: 'creer_classe', outcome: 'REFUSE' },
      orderBy: { timestamp: 'desc' },
    }));
    expect(audit?.refusalReason).toBe('parametre_hallucine');
  });

  it("une action DESTRUCTIVE n'est JAMAIS exécutée directement — mise en attente de confirmation", async () => {
    const classe = await prismaTest.class.create({
      data: { schoolId, academicYearId, name: 'Classe visée', capacity: 30, status: 'ACTIVE' },
    });

    sortieModele = {
      text: '',
      toolCalls: [{ toolName: 'supprimer_classe', input: { className: 'Classe visée' } }],
    };

    const { body } = await demander(adminToken);

    expect(body.type).toBe('confirm');
    expect(body.pending?.[0]?.actionType).toBe('supprimer_classe');
    expect(body.executed ?? []).toHaveLength(0);

    // La classe est TOUJOURS là : rien n'a été supprimé sans confirmation explicite.
    const apres = await prismaTest.class.findFirst({ where: { id: classe.id, deletedAt: null } });
    expect(apres).not.toBeNull();

    // Le log est bien en attente, pas exécuté.
    const log = await prismaTest.assistantActionLog.findUniqueOrThrow({
      where: { id: body.pending![0]!.pendingActionId },
    });
    expect(log.status).toBe('PENDING_CONFIRMATION');
    expect(log.destructive).toBe(true);

    await prismaTest.class.delete({ where: { id: classe.id } });
  });

  it('exécute réellement une action AUTORISÉE et non destructive (le chemin nominal fonctionne)', async () => {
    sortieModele = {
      text: '',
      toolCalls: [{ toolName: 'creer_classe', input: { name: '6e Z', level: '6e' } }],
    };

    const { body } = await demander(adminToken);

    expect(body.type).toBe('executed');
    expect(body.executed?.[0]?.error).toBeUndefined();

    const classe = await prismaTest.class.findFirst({ where: { schoolId, name: '6e Z' } });
    expect(classe).not.toBeNull();

    await prismaTest.class.deleteMany({ where: { schoolId, name: '6e Z' } });
  });

  it("sur plusieurs outils dont un interdit, seul l'autorisé passe", async () => {
    sortieModele = {
      text: '',
      toolCalls: [
        { toolName: 'creer_classe', input: { name: '5e Y', level: '5e' } },
        { toolName: 'outil_inexistant', input: {} },
      ],
    };

    const { body } = await demander(adminToken);

    const erreurs = (body.executed ?? []).filter(e => e.error);
    const succes = (body.executed ?? []).filter(e => !e.error);
    expect(erreurs).toHaveLength(1);
    expect(succes).toHaveLength(1);
    expect(await prismaTest.class.count({ where: { schoolId, name: '5e Y' } })).toBe(1);

    await prismaTest.class.deleteMany({ where: { schoolId, name: '5e Y' } });
  });

  it('sans aucun tool call, rien ne s\'exécute — simple réponse texte', async () => {
    sortieModele = { text: 'Voici votre réponse.', toolCalls: [] };

    const { body } = await demander(adminToken);

    expect(body.type).toBe('message');
    expect(body.response).toBe('Voici votre réponse.');
    expect(await prismaTest.class.count({ where: { schoolId } })).toBe(0);
  });
});
