import type { Request, Response, NextFunction } from 'express';
import type { PrismaClient } from '@prisma/client';
import {
  generateAttestationTravailPdf,
  generateCertificatTravailPdf,
  generateMissionOrderPdf,
} from '../../../utils/hrDocuments';
import { resolveLanguage } from '../../../utils/languageHelper';

type EmployeeRole = 'TEACHER' | 'STAFF';
type LeaveStatusValue = 'PENDING' | 'APPROVED' | 'REJECTED';

function normalizeDateInput(value?: string | null): Date {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function normalizeDateKey(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function formatEmployeeName(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`.trim();
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function daysBetweenInclusive(startDate: Date, endDate: Date): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diff = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  return diff + 1;
}

export class HRController {
  constructor(private readonly prisma: PrismaClient) {}

  private getSchoolId(req: Request): string {
    return (req as any).user?.schoolId;
  }

  private getCurrentUser(req: Request): any {
    return (req as any).user;
  }

  private async loadEmployeeOrFail(userId: string, schoolId: string) {
    return this.prisma.user.findFirst({
      where: { id: userId, schoolId, role: { in: ['TEACHER', 'STAFF'] as EmployeeRole[] } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        teacherProfile: { select: { id: true, specialization: true, supervisedSubjectIds: true } },
        staffProfile: { select: { id: true, title: true, sectionId: true } },
        school: { select: { id: true, name: true, subsystem: true } },
      },
    });
  }

  private async getEmployeeSectionCode(userId: string, schoolId: string): Promise<string | null> {
    try {
      const staff = await (this.prisma as any).staffProfile.findUnique({ where: { userId } });
      if (!staff?.sectionId) return null;
      const section = await (this.prisma as any).section.findUnique({ where: { id: staff.sectionId } });
      return section?.code ?? null;
    } catch {
      return null;
    }
  }

  private async fetchEmployeeFile(userId: string) {
    return (this.prisma as any).employeeFile.findUnique({ where: { userId } });
  }

  private async getCurrentLeaveBalance(userId: string, schoolId: string) {
    const year = new Date().getFullYear();
    const balance = await (this.prisma as any).leaveBalance.findUnique({
      where: { userId_annee: { userId, annee: year } },
    }).catch(() => null);

    if (balance) return balance;

    const fallback = await (this.prisma as any).leaveBalance.findFirst({
      where: { userId, schoolId },
      orderBy: { annee: 'desc' },
    });

    if (fallback) return fallback;

    return (this.prisma as any).leaveBalance.create({
      data: {
        userId,
        schoolId,
        annee: year,
        soldeInitial: 30,
        soldeRestant: 30,
      },
    });
  }

  private async ensureLeaveBalance(userId: string, schoolId: string) {
    const year = new Date().getFullYear();
    const existing = await (this.prisma as any).leaveBalance.findUnique({
      where: { userId_annee: { userId, annee: year } },
    }).catch(() => null);

    if (existing) return existing;

    return (this.prisma as any).leaveBalance.create({
      data: {
        userId,
        schoolId,
        annee: year,
        soldeInitial: 30,
        soldeRestant: 30,
      },
    });
  }

  private async sendPdf(res: Response, filename: string, buffer: Buffer): Promise<void> {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  listEmployees = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const users = await this.prisma.user.findMany({
        where: { schoolId, role: { in: ['TEACHER', 'STAFF'] } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          role: true,
          teacherProfile: { select: { id: true, specialization: true, supervisedSubjectIds: true } },
          staffProfile: { select: { id: true, title: true, sectionId: true } },
        },
        orderBy: [{ role: 'asc' }, { lastName: 'asc' }, { firstName: 'asc' }],
      });

      const files = await (this.prisma as any).employeeFile.findMany({
        where: { userId: { in: users.map((employee) => employee.id) } },
      });
      const fileByUserId = new Map<string, any>(files.map((file: any) => [file.userId, file]));

      res.json({
        success: true,
        data: users.map((employee) => ({
          ...employee,
          fullName: formatEmployeeName(employee),
          file: fileByUserId.get(employee.id) ?? null,
        })),
      });
    } catch (error) {
      next(error);
    }
  };

  getEmployee = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const { id } = req.params;

      const employeeId = String(id);
      const employee = await this.loadEmployeeOrFail(employeeId, schoolId);
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employé introuvable' });
        return;
      }

      const [file, careerEvents, leaveRequests, leaveBalance] = await Promise.all([
        this.fetchEmployeeFile(employeeId),
        (this.prisma as any).careerEvent.findMany({ where: { userId: employeeId, schoolId }, orderBy: { date: 'desc' } }),
        (this.prisma as any).leaveRequest.findMany({ where: { userId: employeeId, schoolId }, orderBy: { createdAt: 'desc' } }),
        this.getCurrentLeaveBalance(employeeId, schoolId),
      ]);

      res.json({
        success: true,
        data: {
          employee: {
            ...employee,
            fullName: formatEmployeeName(employee),
          },
          file,
          careerEvents,
          leaveRequests,
          leaveBalance,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getEmployeeFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const employeeId = String(req.params.id);

      const employee = await this.loadEmployeeOrFail(employeeId, schoolId);
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employé introuvable' });
        return;
      }

      const file = await this.fetchEmployeeFile(employeeId);
      res.json({ success: true, data: file });
    } catch (error) {
      next(error);
    }
  };

  saveEmployeeFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const employeeId = String(req.params.id);
      const body = req.body as {
        dateNaissance?: string | null;
        diplomes?: unknown;
        numeroCNPS?: string | null;
        typeContrat?: string | null;
        dateEmbauche?: string | null;
        echelonActuel?: string | null;
      };

      const employee = await this.loadEmployeeOrFail(employeeId, schoolId);
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employé introuvable' });
        return;
      }

      const data = {
        dateNaissance: body.dateNaissance ? normalizeDateInput(body.dateNaissance) : null,
        diplomes: body.diplomes ?? [],
        numeroCNPS: body.numeroCNPS?.trim() || null,
        typeContrat: body.typeContrat?.trim() || null,
        dateEmbauche: body.dateEmbauche ? normalizeDateInput(body.dateEmbauche) : null,
        echelonActuel: body.echelonActuel?.trim() || null,
      };

      const existing = await this.fetchEmployeeFile(employeeId);
      const file = existing
        ? await (this.prisma as any).employeeFile.update({ where: { userId: employeeId }, data })
        : await (this.prisma as any).employeeFile.create({ data: { ...data, userId: employeeId, schoolId } });

      res.status(existing ? 200 : 201).json({ success: true, data: file });
    } catch (error) {
      next(error);
    }
  };

  addCareerEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const employeeId = String(req.params.id);
      const body = req.body as { type?: string; date?: string; observation?: string };

      const employee = await this.loadEmployeeOrFail(employeeId, schoolId);
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employé introuvable' });
        return;
      }

      if (!body.type || !body.date) {
        res.status(400).json({ success: false, message: 'type et date sont requis' });
        return;
      }

      const event = await (this.prisma as any).careerEvent.create({
        data: {
          userId: employeeId,
          schoolId,
          type: body.type,
          date: normalizeDateInput(body.date),
          observation: body.observation?.trim() || null,
        },
      });

      res.status(201).json({ success: true, data: event });
    } catch (error) {
      next(error);
    }
  };

  listCareerEvents = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const employeeId = String(req.params.id);

      const employee = await this.loadEmployeeOrFail(employeeId, schoolId);
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employé introuvable' });
        return;
      }

      const events = await (this.prisma as any).careerEvent.findMany({
        where: { userId: employeeId, schoolId },
        orderBy: { date: 'desc' },
      });

      res.json({ success: true, data: events });
    } catch (error) {
      next(error);
    }
  };

  recordAttendance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const currentUser = this.getCurrentUser(req);
      const body = req.body as { date?: string; attendances?: Array<{ userId: string; statut: string; note?: string | null }> };

      if (!body.date || !Array.isArray(body.attendances) || body.attendances.length === 0) {
        res.status(400).json({ success: false, message: 'date et attendances sont requis' });
        return;
      }

      const date = normalizeDateInput(body.date);
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);

      const results = await Promise.all(body.attendances.map(async (entry) => {
        const employee = await this.loadEmployeeOrFail(entry.userId, schoolId);
        if (!employee) return null;

        return (this.prisma as any).staffAttendance.upsert({
          where: { userId_date: { userId: entry.userId, date: normalizedDate } },
          create: {
            userId: entry.userId,
            schoolId,
            date: normalizedDate,
            statut: entry.statut,
            note: entry.note?.trim() || null,
          },
          update: {
            statut: entry.statut,
            note: entry.note?.trim() || null,
          },
        });
      }));

      res.status(201).json({
        success: true,
        data: results.filter(Boolean),
        meta: { recordedBy: currentUser?.id ?? null, date: normalizedDate.toISOString() },
      });
    } catch (error) {
      next(error);
    }
  };

  listAttendance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const { date, userId } = req.query as Record<string, string>;

      const normalizedDate = normalizeDateKey(date) ?? new Date().toISOString().slice(0, 10);
      const start = new Date(`${normalizedDate}T00:00:00.000Z`);
      const end = new Date(`${normalizedDate}T23:59:59.999Z`);

      const records = await (this.prisma as any).staffAttendance.findMany({
        where: {
          schoolId,
          ...(userId ? { userId } : {}),
          date: { gte: start, lte: end },
        },
        include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      });

      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  };

  createLeaveRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const body = req.body as { userId?: string; type?: string; dateDebut?: string; dateFin?: string; motif?: string };

      if (!body.userId || !body.type || !body.dateDebut || !body.dateFin) {
        res.status(400).json({ success: false, message: 'userId, type, dateDebut et dateFin sont requis' });
        return;
      }

      const employee = await this.loadEmployeeOrFail(body.userId, schoolId);
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employé introuvable' });
        return;
      }

      await this.ensureLeaveBalance(body.userId, schoolId);

      const leaveRequest = await (this.prisma as any).leaveRequest.create({
        data: {
          userId: body.userId,
          schoolId,
          type: body.type,
          dateDebut: normalizeDateInput(body.dateDebut),
          dateFin: normalizeDateInput(body.dateFin),
          motif: body.motif?.trim() || null,
          statut: 'PENDING',
        },
      });

      res.status(201).json({ success: true, data: leaveRequest });
    } catch (error) {
      next(error);
    }
  };

  updateLeaveRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const currentUser = this.getCurrentUser(req);
      const { id } = req.params;
      const body = req.body as { statut?: LeaveStatusValue };

      if (!body.statut || !['APPROVED', 'REJECTED'].includes(body.statut)) {
        res.status(400).json({ success: false, message: 'statut doit être APPROVED ou REJECTED' });
        return;
      }

      const leaveRequest = await (this.prisma as any).leaveRequest.findFirst({ where: { id, schoolId } });
      if (!leaveRequest) {
        res.status(404).json({ success: false, message: 'Demande introuvable' });
        return;
      }

      if (leaveRequest.statut !== 'PENDING') {
        res.status(409).json({ success: false, message: 'La demande a déjà été traitée' });
        return;
      }

      const updated = await (this.prisma as any).leaveRequest.update({
        where: { id },
        data: {
          statut: body.statut,
          validatedBy: currentUser?.id ?? null,
          validatedAt: new Date(),
        },
      });

      if (body.statut === 'APPROVED') {
        const year = new Date(leaveRequest.dateDebut).getFullYear();
        const balance = await (this.prisma as any).leaveBalance.upsert({
          where: { userId_annee: { userId: leaveRequest.userId, annee: year } },
          create: { userId: leaveRequest.userId, schoolId, annee: year, soldeInitial: 30, soldeRestant: 30 },
          update: {},
        });

        const jours = daysBetweenInclusive(new Date(leaveRequest.dateDebut), new Date(leaveRequest.dateFin));
        await (this.prisma as any).leaveBalance.update({
          where: { id: balance.id },
          data: { soldeRestant: Math.max(0, Number(balance.soldeRestant) - jours) },
        });
      }

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };

  listLeaveRequests = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const { userId, statut } = req.query as Record<string, string>;

      const leaveRequests = await (this.prisma as any).leaveRequest.findMany({
        where: {
          schoolId,
          ...(userId ? { userId } : {}),
          ...(statut ? { statut } : {}),
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
          validator: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: leaveRequests });
    } catch (error) {
      next(error);
    }
  };

  getLeaveBalance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const userId = String(req.params.userId);

      const employee = await this.loadEmployeeOrFail(userId, schoolId);
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employé introuvable' });
        return;
      }

      const balances = await (this.prisma as any).leaveBalance.findMany({ where: { userId, schoolId }, orderBy: { annee: 'desc' } });
      const current = balances[0] ?? await this.getCurrentLeaveBalance(userId, schoolId);

      res.json({ success: true, data: { current, balances } });
    } catch (error) {
      next(error);
    }
  };

  getAttestationTravail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const currentUser = this.getCurrentUser(req);
      const employeeId = String(req.params.id);

      const employee = await this.loadEmployeeOrFail(employeeId, schoolId);
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employé introuvable' });
        return;
      }

      const file = await this.fetchEmployeeFile(employeeId);
      const sectionCode = await this.getEmployeeSectionCode(employeeId, schoolId);
      const lang = resolveLanguage(employee.school.subsystem, sectionCode);
      const roleLabelEn = employee.role === 'TEACHER' ? 'teacher' : 'staff member';
      const pdf = await generateAttestationTravailPdf({
        schoolName: employee.school.name,
        employeeName: formatEmployeeName(employee),
        roleLabel: employee.role === 'TEACHER' ? 'enseignant(e)' : 'membre du personnel',
        roleLabelEn,
        dateEmbauche: file?.dateEmbauche ?? null,
        dateNaissance: file?.dateNaissance ?? null,
        numeroCNPS: file?.numeroCNPS ?? null,
        typeContrat: file?.typeContrat ?? null,
        echelonActuel: file?.echelonActuel ?? null,
        signataire: currentUser?.nomComplet ?? currentUser?.firstName ?? null,
        language: lang,
      });

      await this.sendPdf(res, `attestation-travail-${slugify(formatEmployeeName(employee))}.pdf`, pdf);
    } catch (error) {
      next(error);
    }
  };

  getCertificatTravail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const currentUser = this.getCurrentUser(req);
      const employeeId = String(req.params.id);

      const employee = await this.loadEmployeeOrFail(employeeId, schoolId);
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employé introuvable' });
        return;
      }

      const file = await this.fetchEmployeeFile(employeeId);
      const sectionCode = await this.getEmployeeSectionCode(employeeId, schoolId);
      const lang = resolveLanguage(employee.school.subsystem, sectionCode);
      const roleLabelEn = employee.role === 'TEACHER' ? 'teacher' : 'staff member';
      const pdf = await generateCertificatTravailPdf({
        schoolName: employee.school.name,
        employeeName: formatEmployeeName(employee),
        roleLabel: employee.role === 'TEACHER' ? 'enseignant(e)' : 'membre du personnel',
        roleLabelEn,
        dateEmbauche: file?.dateEmbauche ?? null,
        dateNaissance: file?.dateNaissance ?? null,
        numeroCNPS: file?.numeroCNPS ?? null,
        typeContrat: file?.typeContrat ?? null,
        echelonActuel: file?.echelonActuel ?? null,
        signataire: currentUser?.nomComplet ?? currentUser?.firstName ?? null,
        language: lang,
      });

      await this.sendPdf(res, `certificat-travail-${slugify(formatEmployeeName(employee))}.pdf`, pdf);
    } catch (error) {
      next(error);
    }
  };

  createMissionOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const body = req.body as { userId?: string; motif?: string; lieu?: string; dateDebut?: string; dateFin?: string; signataire?: string };

      if (!body.userId || !body.motif || !body.lieu || !body.dateDebut || !body.dateFin) {
        res.status(400).json({ success: false, message: 'userId, motif, lieu, dateDebut et dateFin sont requis' });
        return;
      }

      const employee = await this.loadEmployeeOrFail(body.userId, schoolId);
      if (!employee) {
        res.status(404).json({ success: false, message: 'Employé introuvable' });
        return;
      }

      const missionOrder = await (this.prisma as any).missionOrder.create({
        data: {
          userId: body.userId,
          schoolId,
          motif: body.motif.trim(),
          lieu: body.lieu.trim(),
          dateDebut: normalizeDateInput(body.dateDebut),
          dateFin: normalizeDateInput(body.dateFin),
          signataire: body.signataire?.trim() || null,
        },
      });

      res.status(201).json({ success: true, data: missionOrder });
    } catch (error) {
      next(error);
    }
  };

  getMissionOrderPdf = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = this.getSchoolId(req);
      const missionId = String(req.params.id);

      const missionOrder = await (this.prisma as any).missionOrder.findFirst({
        where: { id: missionId, schoolId },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
          school: { select: { id: true, name: true, subsystem: true } },
        },
      });

      if (!missionOrder) {
        res.status(404).json({ success: false, message: 'Ordre de mission introuvable' });
        return;
      }

      const sectionCode = await this.getEmployeeSectionCode(missionOrder.user.id, schoolId);
      const lang = resolveLanguage(missionOrder.school.subsystem, sectionCode);
      const pdf = await generateMissionOrderPdf({
        schoolName: missionOrder.school.name,
        employeeName: formatEmployeeName(missionOrder.user),
        motif: missionOrder.motif,
        lieu: missionOrder.lieu,
        dateDebut: missionOrder.dateDebut,
        dateFin: missionOrder.dateFin,
        signataire: missionOrder.signataire ?? null,
        language: lang,
      });

      await this.sendPdf(res, `ordre-mission-${slugify(formatEmployeeName(missionOrder.user))}.pdf`, pdf);
    } catch (error) {
      next(error);
    }
  };
}
