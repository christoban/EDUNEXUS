import { User } from '@domain/entities/User';
import type { ImportUtilisateursRepository } from '@domain/ports/repositories/ImportUtilisateursRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { EmailService } from '@domain/ports/services/EmailService';
import type { ParentImportRow } from '../dto/ImportUserDtos';
import { envoyerEmailDevMode, envoyerEmailLienInvitation } from './importEmailNotifications';

interface Dependencies {
  importRepository: ImportUtilisateursRepository;
  userRepository: UserRepository;
  emailService: EmailService;
}

export async function traiterLigneParent(
  deps: Dependencies,
  schoolId: string,
  row: ParentImportRow,
  passwordHash: string,
  isDevMode: boolean,
  schoolName: string,
): Promise<void> {
  const { importRepository, userRepository, emailService } = deps;

  if (!row.nom?.trim()) throw new Error('Nom obligatoire');
  if (!row.prenom?.trim()) throw new Error('Prénom obligatoire');
  const email = row.email?.trim().toLowerCase();
  const phone = row.telephone?.trim() || undefined;
  if (!email && !phone) throw new Error('Email ou téléphone obligatoire');

  const studentProfileIds: string[] = [];

  if (row.matriculesEnfants?.trim()) {
    const matricules = row.matriculesEnfants.split(',').map((m) => m.trim()).filter(Boolean);
    const found = await importRepository.findStudentsParMatricules(schoolId, matricules);
    studentProfileIds.push(...found.map((f) => f.studentProfileId));
  }

  if (row.emailsEnfants?.trim()) {
    const emails = row.emailsEnfants.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    const found = await importRepository.findStudentsParEmails(schoolId, emails);
    studentProfileIds.push(...found.map((f) => f.studentProfileId));
  }

  const parentUser = User.create({
    schoolId,
    role: 'PARENT',
    email,
    phone,
    firstName: row.prenom.trim(),
    lastName: row.nom.trim(),
  });

  await userRepository.saveAvecProfil(parentUser, {
    passwordHash,
    parentOfStudentIds: studentProfileIds,
  });

  if (isDevMode) {
    await envoyerEmailDevMode(emailService, email || '', row.prenom.trim(), row.nom.trim(), schoolId, 'schoolName').catch(() => {});
  } else {
    await envoyerEmailLienInvitation(emailService, parentUser.id, email || '', row.prenom.trim(), row.nom.trim(), schoolId, 'schoolName').catch(() => {});
  }
}