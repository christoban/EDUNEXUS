import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import {
  generateCertificatPdf,
  generateCarteScolairepdf,
  generateLettreTransfertPdf,
} from '../../../utils/schoolDocuments/index';
import { resolveLanguage } from '../../../utils/languageHelper';

const VERIFY_BASE = process.env.CLIENT_URL || 'http://localhost:3000';

async function fetchStudent(prisma: PrismaClient, userId: string, schoolId: string) {
  return prisma.studentProfile.findFirst({
    where: { userId, user: { schoolId } },
    include: {
      user: { select: { firstName: true, lastName: true, phone: true, schoolId: true } },
      class: { select: { name: true, section: { select: { code: true } } } },
      parents: {
        include: {
          parentProfile: {
            include: { user: { select: { firstName: true, lastName: true, phone: true } } },
          },
        },
        take: 1,
      },
    },
  });
}

async function fetchSchool(prisma: PrismaClient, schoolId: string) {
  return prisma.school.findUnique({
    where: { id: schoolId },
    select: { name: true, city: true, phone: true, logoUrl: true, subsystem: true },
  });
}

async function fetchCurrentYear(prisma: PrismaClient, schoolId: string) {
  return prisma.academicYear.findFirst({
    where: { schoolId, isCurrent: true },
    select: { name: true },
  });
}

export class StudentDocumentController {
  constructor(private readonly prisma: PrismaClient) {}

  // ─── GET /api/v2/students/:id/certificat ─────────────────────
  getCertificat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const studentUserId = req.params.id as string;

      const student = await fetchStudent(this.prisma, studentUserId, user.schoolId);
      if (!student) {
        res.status(404).json({ success: false, message: 'Élève introuvable' });
        return;
      }

      const [school, year] = await Promise.all([
        fetchSchool(this.prisma, user.schoolId),
        fetchCurrentYear(this.prisma, user.schoolId),
      ]);

      const studentName = `${student.user.lastName} ${student.user.firstName}`;

      const doc = await this.prisma.verifiableDocument.create({
        data: {
          type: 'CERTIFICATE',
          studentId: student.id,
          schoolId: user.schoolId,
          dataSnapshot: {
            studentName,
            matricule: student.matricule ?? null,
            className: student.class?.name ?? '—',
            yearName: year?.name ?? '—',
            status: student.studentStatus,
          },
        },
      });

      const lang = resolveLanguage(school?.subsystem, student.class?.section?.code)
      const pdf = await generateCertificatPdf({
        documentId: doc.id,
        school: {
          name: school?.name ?? 'Établissement',
          ville: school?.city ?? undefined,
          tel: school?.phone ?? undefined,
        },
        studentName,
        matricule: student.matricule ?? undefined,
        className: student.class?.name ?? '—',
        yearName: year?.name ?? '—',
        dateOfBirth: student.dateOfBirth
          ? student.dateOfBirth.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR')
          : undefined,
        gender: student.gender ?? undefined,
        status: student.studentStatus,
        generatedAt: new Date(),
        verifyUrl: `${VERIFY_BASE}/verify/${doc.id}`,
        language: lang,
      });

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="certificat-${student.matricule ?? studentUserId}.pdf"`,
        'Content-Length': pdf.length,
      });
      res.end(pdf);
    } catch (err) {
      next(err);
    }
  };

  // ─── GET /api/v2/students/:id/carte ──────────────────────────
  getCarte = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const studentUserId = req.params.id as string;

      const student = await fetchStudent(this.prisma, studentUserId, user.schoolId);
      if (!student) {
        res.status(404).json({ success: false, message: 'Élève introuvable' });
        return;
      }

      const [school, year] = await Promise.all([
        fetchSchool(this.prisma, user.schoolId),
        fetchCurrentYear(this.prisma, user.schoolId),
      ]);

      const studentName = `${student.user.lastName} ${student.user.firstName}`;
      const parent = student.parents[0]?.parentProfile?.user;

      const doc = await this.prisma.verifiableDocument.create({
        data: {
          type: 'STUDENT_CARD',
          studentId: student.id,
          schoolId: user.schoolId,
          dataSnapshot: {
            studentName,
            matricule: student.matricule ?? null,
            className: student.class?.name ?? '—',
            yearName: year?.name ?? '—',
          },
        },
      });

      const lang = resolveLanguage(school?.subsystem, student.class?.section?.code)
      const pdf = await generateCarteScolairepdf({
        documentId: doc.id,
        school: {
          name: school?.name ?? 'Établissement',
          ville: school?.city ?? undefined,
        },
        studentName,
        matricule: student.matricule ?? undefined,
        className: student.class?.name ?? '—',
        yearName: year?.name ?? '—',
        photoUrl: student.photoUrl ?? undefined,
        emergencyContact: parent ? `${parent.lastName} ${parent.firstName}` : undefined,
        emergencyPhone: parent?.phone ?? student.user.phone ?? undefined,
        generatedAt: new Date(),
        verifyUrl: `${VERIFY_BASE}/verify/${doc.id}`,
        language: lang,
      });

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="carte-scolaire-${student.matricule ?? studentUserId}.pdf"`,
        'Content-Length': pdf.length,
      });
      res.end(pdf);
    } catch (err) {
      next(err);
    }
  };

  // ─── GET /api/v2/students/:id/lettre-transfert ───────────────
  getLettreTransfert = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;
      const studentUserId = req.params.id as string;
      const motif = (req.query.motif as string | undefined) ?? '';

      const student = await fetchStudent(this.prisma, studentUserId, user.schoolId);
      if (!student) {
        res.status(404).json({ success: false, message: 'Élève introuvable' });
        return;
      }

      if (!['TRANSFERRED', 'LEFT', 'GRADUATED'].includes(student.studentStatus)) {
        res.status(400).json({
          success: false,
          message: "La lettre de transfert n'est disponible que pour les élèves transférés ou sortis.",
        });
        return;
      }

      const [school, year, lastBulletin] = await Promise.all([
        fetchSchool(this.prisma, user.schoolId),
        fetchCurrentYear(this.prisma, user.schoolId),
        this.prisma.reportCard.findFirst({
          where: { studentId: studentUserId, schoolId: user.schoolId },
          orderBy: { createdAt: 'desc' },
          select: { generalAverage: true },
        }),
      ]);

      const studentName = `${student.user.lastName} ${student.user.firstName}`;

      const doc = await this.prisma.verifiableDocument.create({
        data: {
          type: 'TRANSFER_LETTER',
          studentId: student.id,
          schoolId: user.schoolId,
          dataSnapshot: {
            studentName,
            matricule: student.matricule ?? null,
            className: student.class?.name ?? '—',
            yearName: year?.name ?? '—',
            motif: motif || student.studentStatus,
          },
        },
      });

      const lang = resolveLanguage(school?.subsystem, student.class?.section?.code)
      const pdf = await generateLettreTransfertPdf({
        documentId: doc.id,
        school: {
          name: school?.name ?? 'Établissement',
          ville: school?.city ?? undefined,
          tel: school?.phone ?? undefined,
        },
        studentName,
        matricule: student.matricule ?? undefined,
        className: student.class?.name ?? '—',
        yearName: year?.name ?? '—',
        motif: motif || student.studentStatus,
        lastAverage: lastBulletin?.generalAverage ?? undefined,
        generatedAt: new Date(),
        verifyUrl: `${VERIFY_BASE}/verify/${doc.id}`,
        language: lang,
      });

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="transfert-${student.matricule ?? studentUserId}.pdf"`,
        'Content-Length': pdf.length,
      });
      res.end(pdf);
    } catch (err) {
      next(err);
    }
  };

  // ─── GET /api/v2/verify/:documentId (PUBLIC) ─────────────────
  verifyDocument = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const documentId = req.params.documentId as string;

      const doc = await this.prisma.verifiableDocument.findUnique({
        where: { id: documentId },
      });

      if (!doc) {
        res.status(404).json({ success: false, message: 'Document introuvable ou invalide.' });
        return;
      }

      const school = await this.prisma.school.findUnique({
        where: { id: doc.schoolId },
        select: { name: true },
      });

      const typeLabel: Record<string, string> = {
        CERTIFICATE: 'Certificat de scolarité',
        STUDENT_CARD: "Carte d'identité scolaire",
        TRANSFER_LETTER: 'Lettre de transfert',
        REPORT_CARD: 'Bulletin de notes',
      };

      res.json({
        success: true,
        document: {
          id: doc.id.slice(0, 8).toUpperCase(),
          type: typeLabel[doc.type] ?? doc.type,
          school: school?.name ?? '—',
          generatedAt: doc.generatedAt,
          data: doc.dataSnapshot,
          authentic: true,
        },
      });
    } catch (err) {
      next(err);
    }
  };
}
