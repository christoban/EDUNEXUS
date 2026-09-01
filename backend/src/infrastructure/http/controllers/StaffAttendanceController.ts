/**
 * HTTP LAYER — Controller Pointage présence enseignants (V2.11)
 *
 * Routes :
 * - POST /api/v2/staff-attendance/pointer — l'enseignant pointe (QR / GPS / manuel)
 * - GET  /api/v2/staff-attendance/scan-info — salle + cours courant (affiche le QR à scanner)
 * - GET  /api/v2/staff-attendance/a-verifier — liste RH des entrées A_VERIFIER
 * - PATCH /api/v2/staff-attendance/:id/requalifier — RH requalifie un A_VERIFIER → PRESENT
 */
import type { Request, Response, NextFunction } from 'express';
import type { PointerPresenceEnseignantUseCase } from '@application/staffAttendance/PointerPresenceEnseignantUseCase';
import type { StaffAttendanceRepository } from '@domain/ports/repositories/StaffAttendanceRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';

export class StaffAttendanceController {
  constructor(
    private readonly pointerUseCase: PointerPresenceEnseignantUseCase,
    private readonly staffAttendanceRepository: StaffAttendanceRepository,
    private readonly audit: AIActionAuditPort,
  ) {}

  // POST /api/v2/staff-attendance/pointer
  pointer = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const body = req.body as {
        mode?: 'QR' | 'GPS' | 'MANUEL';
        qrToken?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        teacherId?: string;
      };

      // L'enseignant pointe pour lui-même ; un RH/Admin peut pointer pour un enseignant (mode MANUEL).
      const teacherId = req.user!.role === 'TEACHER' ? req.user!.userId : (body.teacherId ?? req.user!.userId);
      const mode = body.mode ?? 'MANUEL';

      const result = await this.pointerUseCase.execute({
        teacherId,
        schoolId,
        mode,
        qrToken: body.qrToken ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
      });

      this.audit.journaliser({
        actorUserId: req.user!.userId, actorRole: req.user!.role, schoolId,
        actionName: 'pointer_presence_enseignant', targetType: 'StaffAttendance', targetId: result.attendance.id,
        origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { mode, aVerifier: result.aVerifier, teacherId },
      });

      res.status(201).json({ success: true, data: { attendance: result.attendance, slot: result.slot, aVerifier: result.aVerifier } });
    } catch (error) {
      this.audit.journaliser({
        actorUserId: req.user?.userId, actorRole: req.user?.role, schoolId: req.user?.schoolId,
        actionName: 'pointer_presence_enseignant', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.body,
      });
      next(error);
    }
  };

  // GET /api/v2/staff-attendance/scan-info — salle + cours courant (l'enseignant affiche le QR de sa salle)
  scanInfo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const { roomId } = req.query as { roomId?: string };
      if (!roomId) {
        res.status(400).json({ success: false, message: 'roomId requis' }); return;
      }
      const token = await this.pointerUseCase.genererTokenSalle(roomId, schoolId);
      res.json({ success: true, data: { qrToken: token } });
    } catch (error) {
      if (error instanceof Error && error.message.includes('QR non configuré')) {
        res.status(400).json({ success: false, message: error.message }); return;
      }
      next(error);
    }
  };

  // GET /api/v2/staff-attendance/a-verifier — liste RH des pointages à requalifier
  listerAVerifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const records = await this.staffAttendanceRepository.findBySchool(schoolId, { statut: 'A_VERIFIER' });
      res.json({ success: true, data: records });
    } catch (error) {
      next(error);
    }
  };

  // PATCH /api/v2/staff-attendance/:id/requalifier — RH requalifie un A_VERIFIER
  requalifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = req.user!.schoolId;
      const id = req.params['id'] as string;
      const { statut } = req.body as { statut?: 'PRESENT' | 'ABSENT' | 'RETARD' };
      if (!statut || !['PRESENT', 'ABSENT', 'RETARD'].includes(statut)) {
        res.status(400).json({ success: false, message: 'statut requis (PRESENT, ABSENT ou RETARD)' }); return;
      }
      const updated = await this.staffAttendanceRepository.requalifier(id, schoolId, statut, req.user!.userId);
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  };
}