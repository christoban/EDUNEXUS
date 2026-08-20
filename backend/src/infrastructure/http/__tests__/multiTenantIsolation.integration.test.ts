/**
 * Test d'intégration — Isolation multi-tenant
 * Prérequis : bun test --env-file .env.test
 *
 * Vérifie qu'un token JWT valide de l'école A ne peut ni LIRE ni MODIFIER les données de
 * l'école B sur les routes principales (notes, bulletins, paiements, utilisateurs/élèves) — le
 * critère de sortie explicite de la roadmap V0.2 ("impossible pour l'établissement A de lire/
 * modifier les données de B"), jamais vérifié automatiquement jusqu'ici.
 *
 * Fait tourner une vraie instance Express (les mêmes routes/contrôleurs que server.ts, via
 * bootstrapHexagonal) sur un port aléatoire, et envoie de vraies requêtes HTTP.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { bootstrapHexagonal } from '@infrastructure/config/hexagonal.bootstrap';
import { creerEleveAvecClasse } from '@application/shared/studentEnrollment';
import { prismaTest } from '../../persistence/prisma/__tests__/helpers/prismaTestClient';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../persistence/prisma/__tests__/helpers/dbFixtures';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET non défini — requis dans .env.test pour ce test.');
}

let server: Server;
let baseUrl: string;

let schoolA: { id: string };
let schoolB: { id: string };
let adminA: { id: string };
let studentB: { id: string };
let classB: { id: string };
let otherClassB: { id: string };
let gradeB: { id: string };
let academicSequenceB: { id: string };
let reportCardB: { id: string };
let paymentB: { id: string };
let tokenA: string;

const signAccessToken = (payload: { userId: string; schoolId: string; role: string }) =>
  jwt.sign(
    { ...payload, permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

const authHeaders = (token: string) => ({
  Cookie: `access_token=${token}`,
  'Content-Type': 'application/json',
});

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);

  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  schoolA = await creerEcoleTest(prismaTest, 'isoA');
  schoolB = await creerEcoleTest(prismaTest, 'isoB');
  adminA = await creerUtilisateurTest(prismaTest, schoolA.id, { role: 'ADMIN' });

  const academicYearB = await prismaTest.academicYear.create({
    data: { schoolId: schoolB.id, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30') },
  });

  classB = await prismaTest.class.create({ data: { schoolId: schoolB.id, name: '6ème B', academicYearId: academicYearB.id } });
  otherClassB = await prismaTest.class.create({ data: { schoolId: schoolB.id, name: '5ème B', academicYearId: academicYearB.id } });
  const subjectB = await prismaTest.subject.create({ data: { schoolId: schoolB.id, name: 'Maths B' } });

  const studentUserB = await creerUtilisateurTest(prismaTest, schoolB.id, { role: 'STUDENT' });
  studentB = studentUserB;
  await creerEleveAvecClasse(prismaTest, { userId: studentB.id, classId: classB.id, enrolledById: studentB.id });

  const academicPeriodB = await prismaTest.academicPeriod.create({
    data: { academicYearId: academicYearB.id, name: 'Trimestre 1', orderIndex: 1, startDate: new Date('2025-09-01'), endDate: new Date('2025-12-20') },
  });
  academicSequenceB = await prismaTest.academicSequence.create({
    data: { academicPeriodId: academicPeriodB.id, schoolId: schoolB.id, name: 'Séquence 1', type: 'DS', orderIndex: 1 },
  });

  gradeB = await prismaTest.grade.create({
    data: {
      schoolId: schoolB.id, studentId: studentB.id, subjectId: subjectB.id, classId: classB.id,
      academicYearId: academicYearB.id, sequenceId: academicSequenceB.id,
      sequenceAverage: 14, validationStatus: 'VALIDATED',
    },
  });

  reportCardB = await prismaTest.reportCard.create({
    data: {
      schoolId: schoolB.id, studentId: studentB.id, academicYearId: academicYearB.id,
      academicPeriodId: academicPeriodB.id, generalAverage: 14, isGenerated: true,
    },
  });

  const invoiceB = await prismaTest.invoice.create({
    data: { schoolId: schoolB.id, studentId: studentB.id, amount: 10000 },
  });
  paymentB = await prismaTest.payment.create({
    data: { schoolId: schoolB.id, invoiceId: invoiceB.id, studentId: studentB.id, amount: 10000, status: 'SUCCESS' },
  });

  tokenA = signAccessToken({ userId: adminA.id, schoolId: schoolA.id, role: 'ADMIN' });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.payment.deleteMany({ where: { schoolId: schoolB.id } });
  await prismaTest.invoice.deleteMany({ where: { schoolId: schoolB.id } });
  await prismaTest.reportCard.deleteMany({ where: { schoolId: schoolB.id } });
  await prismaTest.grade.deleteMany({ where: { schoolId: schoolB.id } });
  await prismaTest.academicSequence.deleteMany({ where: { schoolId: schoolB.id } });
  await prismaTest.academicPeriod.deleteMany({ where: { academicYear: { schoolId: schoolB.id } } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId: schoolB.id } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId: schoolB.id } });
  await prismaTest.studentProfile.deleteMany({ where: { userId: studentB.id } });
  await prismaTest.subject.deleteMany({ where: { schoolId: schoolB.id } });
  await prismaTest.class.deleteMany({ where: { schoolId: schoolB.id } });
  await prismaTest.user.deleteMany({ where: { schoolId: schoolB.id } });
  await prismaTest.user.deleteMany({ where: { schoolId: schoolA.id } });
  await nettoyerEcole(prismaTest, schoolA.id);
  await nettoyerEcole(prismaTest, schoolB.id);
  await prismaTest.$disconnect();
});

describe("Isolation multi-tenant — un token école A ne doit jamais atteindre les données de l'école B", () => {
  it('NOTES : moyenne élève école B via token école A ne retourne pas la vraie moyenne', async () => {
    const res = await fetch(
      `${baseUrl}/grades/average/${studentB.id}?classId=${classB.id}&sequenceId=${academicSequenceB.id}`,
      { headers: authHeaders(tokenA) },
    );
    const body = await res.json() as { average: number; rank: number; totalStudents: number };
    // La vraie moyenne de l'élève B est 14 — un token A ne doit jamais la voir.
    expect(body.average).not.toBe(14);
    expect(body).toEqual({ average: 0, rank: 0, totalStudents: 0 });
  });

  it("NOTES : modifier une note de l'école B via token école A est refusé", async () => {
    const res = await fetch(`${baseUrl}/grades/${gradeB.id}`, {
      method: 'PUT',
      headers: authHeaders(tokenA),
      body: JSON.stringify({ sequenceScore: 20 }),
    });
    expect(res.status).toBe(404);

    const toujoursIntacte = await prismaTest.grade.findUnique({ where: { id: gradeB.id } });
    expect(toujoursIntacte?.sequenceAverage).toBe(14);
  });

  it("BULLETINS : télécharger le PDF d'un bulletin de l'école B via token école A est refusé", async () => {
    const res = await fetch(`${baseUrl}/report-cards/${reportCardB.id}/pdf`, {
      headers: authHeaders(tokenA),
    });
    expect(res.status).toBe(404);
  });

  it("PAIEMENTS : récupérer le reçu d'un paiement de l'école B via token école A est refusé", async () => {
    const res = await fetch(`${baseUrl}/finance/payments/${paymentB.id}/receipt`, {
      headers: authHeaders(tokenA),
    });
    expect(res.status).toBe(403);
  });

  it("UTILISATEURS : modifier un élève de l'école B via token école A est refusé", async () => {
    const res = await fetch(`${baseUrl}/users/${studentB.id}`, {
      method: 'PUT',
      headers: authHeaders(tokenA),
      body: JSON.stringify({ firstName: 'Piraté' }),
    });
    // ModifierUtilisateurUseCase lève "Accès refusé : utilisateur hors de votre établissement" —
    // UserController.gererErreur matchait auparavant seulement 'refusée' (avec un e final), pas
    // 'refusé' (masculin) → tombait dans le handler générique (500) au lieu d'un 403 propre. Bug
    // de mapping HTTP corrigé (gererErreur matche désormais la racine 'refusé', et tous les
    // messages d'autorisation de ce module sont standardisés avec le préfixe "Accès refusé : ").
    expect(res.status).toBe(403);

    const toujoursIntact = await prismaTest.user.findUnique({ where: { id: studentB.id } });
    expect(toujoursIntact?.firstName).not.toBe('Piraté');
  });

  it("ÉLÈVES : transférer un élève de l'école B vers une classe de l'école B via token école A est refusé", async () => {
    const res = await fetch(`${baseUrl}/users/students/${studentB.id}/transfer`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({ fromClasseId: classB.id, toClasseId: otherClassB.id }),
    });
    expect(res.status).toBe(403);

    const enrollmentInchange = await prismaTest.enrollment.findFirst({
      where: { student: { userId: studentB.id }, status: 'ACTIVE' },
    });
    expect(enrollmentInchange?.classId).toBe(classB.id);
  });
});
