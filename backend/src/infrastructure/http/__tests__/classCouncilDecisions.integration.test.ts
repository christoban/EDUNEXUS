/**
 * Test d'intégration — ClassCouncilController, touché par le retrait de 13 casts `as any`
 * (enum `CouncilDecision`, enum `ReportCardStatus`, résultats de findFirst). Vérifie sur la
 * vraie base que la création de session (avec pré-peuplement DELIBERATION), la voie de
 * décision unitaire ET la voie en bloc fonctionnent toujours après un typage précis.
 *
 * Vérifie aussi le correctif ajouté au passage : ajouterDecisionsEnBloc ne validait pas la
 * valeur `decision` avant de la caster (contrairement à la voie unitaire, qui le fait) — une
 * valeur hors énumération y aurait fait échouer Prisma à l'exécution (500) plutôt qu'un 400
 * propre. La validation manquante a été ajoutée pour aligner les deux voies.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { creerEleveAvecClasse } from '@application/shared/studentEnrollment';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { bootstrapHexagonal } from '@infrastructure/config/hexagonal.bootstrap';
import { prismaTest } from '../../persistence/prisma/__tests__/helpers/prismaTestClient';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../persistence/prisma/__tests__/helpers/dbFixtures';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET non défini — requis dans .env.test pour ce test.');
}

let server: Server;
let baseUrl: string;
let schoolId: string;
let adminToken: string;
let classId: string;
let academicYearId: string;
let academicPeriodId: string;
let studentAId: string;
let studentBId: string;

const authHeaders = () => ({ Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'classCouncil');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30'), isCurrent: true },
  });
  academicYearId = annee.id;
  const classe = await prismaTest.class.create({ data: { schoolId, academicYearId: annee.id, name: '3ème Conseil', level: '3ème' } });
  classId = classe.id;

  const periode = await prismaTest.academicPeriod.create({
    data: { name: 'Trimestre 1', academicYearId: annee.id, orderIndex: 1, startDate: new Date('2025-09-01'), endDate: new Date('2025-12-15') },
  });
  academicPeriodId = periode.id;

  const studentA = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'conseil-a' });
  studentAId = studentA.id;
  await creerEleveAvecClasse(prismaTest, { userId: studentA.id, classId, enrolledById: studentA.id });

  const studentB = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'conseil-b' });
  studentBId = studentB.id;
  await creerEleveAvecClasse(prismaTest, { userId: studentB.id, classId, enrolledById: studentB.id });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.classCouncilDecision.deleteMany({ where: { session: { schoolId } } });
  await prismaTest.classCouncilSession.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.studentProfile.deleteMany({ where: { user: { schoolId } } });
  await prismaTest.academicPeriod.deleteMany({ where: { academicYearId } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

let sessionId: string;

describe('ClassCouncilController — enums CouncilDecision/ReportCardStatus sans cast any', () => {
  it("POST /class-councils crée la session et pré-peuple une décision DELIBERATION par élève", async () => {
    const res = await fetch(`${baseUrl}/class-councils`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ classId, academicPeriodId }),
    });
    const body = await res.json() as { session?: { id: string }; message?: string };
    if (!body.session) throw new Error(`Échec création session : ${JSON.stringify(body)}`);
    expect(res.status).toBe(201);
    sessionId = body.session.id;

    const decisions = await prismaTest.classCouncilDecision.findMany({ where: { sessionId } });
    expect(decisions).toHaveLength(2);
    expect(decisions.every(d => d.decision === 'DELIBERATION')).toBe(true);
  });

  it("POST /:id/decisions (voie unitaire) enregistre la décision PASS", async () => {
    const res = await fetch(`${baseUrl}/class-councils/${sessionId}/decisions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ studentId: studentAId, decision: 'PASS' }),
    });
    const body = await res.json() as { decision?: { decision: string } };
    if (!body.decision) throw new Error(`Échec : ${JSON.stringify(body)}`);
    expect(body.decision.decision).toBe('PASS');
  });

  it("POST /:id/decisions/bulk (voie en bloc) rejette une décision hors énumération avec un 400 propre", async () => {
    const res = await fetch(`${baseUrl}/class-councils/${sessionId}/decisions/bulk`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ decisions: [{ studentId: studentBId, decision: 'PROMOTED_WITH_HONORS' }] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { message?: string };
    expect(body.message).toContain('decision doit être');

    // Confirme qu'aucune écriture partielle n'a eu lieu.
    const decisionB = await prismaTest.classCouncilDecision.findUnique({
      where: { sessionId_studentId: { sessionId, studentId: studentBId } },
    });
    expect(decisionB?.decision).toBe('DELIBERATION');
  });

  it("POST /:id/decisions/bulk enregistre REPEAT pour une décision valide", async () => {
    const res = await fetch(`${baseUrl}/class-councils/${sessionId}/decisions/bulk`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ decisions: [{ studentId: studentBId, decision: 'REPEAT', observations: 'Moyenne insuffisante' }] }),
    });
    const body = await res.json() as { count?: number; message?: string };
    if (!body.count) throw new Error(`Échec : ${JSON.stringify(body)}`);
    expect(res.status).toBe(200);

    const decisionB = await prismaTest.classCouncilDecision.findUnique({
      where: { sessionId_studentId: { sessionId, studentId: studentBId } },
    });
    expect(decisionB?.decision).toBe('REPEAT');
    expect(decisionB?.observations).toBe('Moyenne insuffisante');
  });

  it("POST /:id/lock verrouille la session puis POST /:id/publish-bulletins publie les bulletins GENERATED (enum ReportCardStatus)", async () => {
    // Nécessaire pour lever le blocage "0 décision" — déjà 2 décisions en base à ce stade.
    const lockRes = await fetch(`${baseUrl}/class-councils/${sessionId}/lock`, { method: 'POST', headers: authHeaders() });
    const lockBody = await lockRes.json() as { session?: { status: string } };
    if (!lockBody.session) throw new Error(`Échec verrouillage : ${JSON.stringify(lockBody)}`);
    expect(lockBody.session.status).toBe('LOCKED');

    const reportCard = await prismaTest.reportCard.create({
      data: {
        schoolId, studentId: studentAId, academicPeriodId, academicYearId,
        validationStatus: 'GENERATED', generalAverage: 14, rank: 1, totalStudents: 2, mention: 'Bien',
      },
    });

    const publishRes = await fetch(`${baseUrl}/class-councils/${sessionId}/publish-bulletins`, { method: 'POST', headers: authHeaders() });
    const publishBody = await publishRes.json() as { count?: number; message?: string };
    if (publishBody.count === undefined) throw new Error(`Échec publication : ${JSON.stringify(publishBody)}`);
    expect(publishRes.status).toBe(200);
    expect(publishBody.count).toBe(1);

    const updated = await prismaTest.reportCard.findUnique({ where: { id: reportCard.id } });
    expect(updated?.validationStatus).toBe('SENT');

    await prismaTest.reportCard.deleteMany({ where: { schoolId } });
  });
});
