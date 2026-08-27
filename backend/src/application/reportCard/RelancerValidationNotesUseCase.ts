/**
 * APPLICATION LAYER — Use Case : Relance validation des notes (Inngest grade/submitted)
 * Extrait de backend/src/infrastructure/inngest/functions/reportCards.ts#handleGradeSubmitted
 */
import type { NoteRepository } from "@domain/ports/repositories/NoteRepository";
import type { StaffProfileRepository } from "@domain/ports/repositories/StaffProfileRepository";
import type { UserRepository } from "@domain/ports/repositories/UserRepository";
import type { MatiereRepository } from "@domain/ports/repositories/MatiereRepository";
import type { ClasseRepository } from "@domain/ports/repositories/ClasseRepository";
import type { EmailService } from "@domain/ports/services/EmailService";

export class RelancerValidationNotesUseCase {
  constructor(
    private readonly noteRepository: NoteRepository,
    private readonly staffProfileRepository: StaffProfileRepository,
    private readonly userRepository: UserRepository,
    private readonly matiereRepository: MatiereRepository,
    private readonly classeRepository: ClasseRepository,
    private readonly emailService: EmailService,
  ) {}

  async relancer48h(params: { gradeId: string; schoolId: string }): Promise<{ sent: number; skipped: boolean }> {
    // schoolId param conservé pour signature historique mais la tenancy vient de la note elle-même
    const note = await this.noteRepository.findById(params.gradeId, params.schoolId).catch(() => null);
    // findById exige schoolId strict ; si grade appartient à une autre école, null
    // Fallback : essaye sans filtre schoolId via find brut si nécessaire (non exposé) — on garde null => skip
    if (!note || note.validationStatus !== "SUBMITTED") return { sent: 0, skipped: true };

    const matiere = await this.matiereRepository.findById(note.subjectId).catch(() => null);
    const classe = await this.classeRepository.findById(note.classId).catch(() => null);
    const subjectName = (matiere as any)?.name ?? "matière";
    const className = (classe as any)?.name ?? "";

    const censeurs = await this.staffProfileRepository.findCenseurs(params.schoolId);
    let sent = 0;
    for (const c of censeurs) {
      if (!c.email) continue;
      await this.emailService.envoyer({
        destinataire: c.email,
        recipientUserId: c.userId,
        sujet: `[RELANCE] Notes en attente de validation — ${subjectName} ${className}`,
        contenuHtml: `<p>Bonjour ${c.firstName},<br><br>Des notes de <b>${subjectName}</b> — <b>${className}</b> sont en attente de validation depuis 48h.<br><br>Connectez-vous à ZekoulABia pour valider.</p>`,
        contenuTexte: `Notes en attente depuis 48h : ${subjectName} — ${className}`,
        eventType: "grade_reminder_48h",
      });
      sent++;
    }
    return { sent, skipped: false };
  }

  async alerter72h(params: { gradeId: string; schoolId: string }): Promise<{ sent: number; skipped: boolean }> {
    const note = await this.noteRepository.findById(params.gradeId, params.schoolId).catch(() => null);
    if (!note || note.validationStatus !== "SUBMITTED") return { sent: 0, skipped: true };

    const matiere = await this.matiereRepository.findById(note.subjectId).catch(() => null);
    const classe = await this.classeRepository.findById(note.classId).catch(() => null);
    const subjectName = (matiere as any)?.name ?? "matière";
    const className = (classe as any)?.name ?? "";

    const admins = await this.userRepository.findByRole(params.schoolId, "ADMIN");
    let sent = 0;
    for (const admin of admins) {
      if (!admin.isActive) continue;
      const email = (admin as any).email ?? (admin as any).toObject?.().email;
      const firstName = (admin as any).firstName ?? (admin as any).toObject?.().firstName;
      if (!email) continue;
      await this.emailService.envoyer({
        destinataire: email,
        recipientUserId: admin.id,
        sujet: `[URGENT] Notes bloquées depuis 72h — ${subjectName}`,
        contenuHtml: `<p>Bonjour ${firstName},<br><br>Les notes de <b>${subjectName}</b> — <b>${className}</b> sont en attente de validation depuis <b>72h</b>.<br><br>Action requise immédiatement.</p>`,
        contenuTexte: `URGENT : Notes bloquées depuis 72h — ${subjectName}`,
        eventType: "grade_reminder_72h",
      });
      sent++;
    }
    return { sent, skipped: false };
  }
}
