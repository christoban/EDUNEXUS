import { User } from '@domain/entities/User';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';
import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupMembershipRepository } from '@domain/ports/repositories/StudentGroupMembershipRepository';
import type { ImportUtilisateursRepository } from '@domain/ports/repositories/ImportUtilisateursRepository';
import type { EmailService } from '@domain/ports/services/EmailService';
import { synchroniserAppartenanceLV2, synchroniserAppartenanceProgramme } from '@application/studentGroup/syncGroupMembership';
import type { PebsFiliere } from '@domain/types/enums';
import { parseDateFR } from '../../../shared/date/parseDateFR';
import type { StudentImportRow, ImportRow } from '../dto/ImportUserDtos';
import { envoyerEmailDevMode, envoyerEmailLienInvitation } from './importEmailNotifications';

const DEV_PASS = 'chris123456789';

interface Dependencies {
  importRepository: ImportUtilisateursRepository;
  userRepository: UserRepository;
  anneeRepository: AnneeAcademiqueRepository;
  groupSetRepository: StudentGroupSetRepository;
  groupRepository: StudentGroupRepository;
  membershipRepository: StudentGroupMembershipRepository;
  emailService: EmailService;
}

export async function traiterLigneStudent(
  deps: Dependencies,
  schoolId: string,
  row: ImportRow,
  passwordHash: string,
  isDevMode: boolean,
  schoolName: string,
  classeCache: Map<string, string>,
  lv2NameToId: Map<string, string>,
  hasPEBS: boolean,
): Promise<void> {
  if (!row.nom?.trim()) throw new Error('Nom obligatoire');
  if (!row.prenom?.trim()) throw new Error('Prénom obligatoire');

  const email = row.email?.trim().toLowerCase();
  const phone = row.telephone?.trim() || undefined;
  if (!email && !phone) throw new Error('Email ou téléphone obligatoire');

  let classeId: string | undefined;
  if (row.classe?.trim()) {
    classeId = classeCache.get(row.classe.trim());
    if (!classeId) throw new Error(`Classe "${row.classe.trim()}" introuvable`);
  }

  let dateOfBirth: Date | undefined;
  if (row.dateNaissance?.trim()) {
    dateOfBirth = parserDate(row.dateNaissance.trim());
  }

  const gender = parserSexe(row.sexe);

  let parentUserId: string | undefined;
  if (row.emailParent?.trim()) {
    const parentEmail = row.emailParent.trim().toLowerCase();
    const existingParentId = await deps.importRepository.findParentParEmail(schoolId, parentEmail);
    if (existingParentId) {
      parentUserId = existingParentId;
    } else {
      const parentUser = User.create({
        schoolId,
        role: 'PARENT',
        email: parentEmail,
        phone: row.telephoneParent?.trim() || undefined,
        firstName: row.prenomParent?.trim() || `Parent de ${row.prenom.trim()}`,
        lastName: row.nomParent?.trim() || row.nom.trim(),
      });
      await deps.userRepository.saveAvecProfil(parentUser, {
        passwordHash,
      });
      parentUserId = parentUser.id;
    }
  }

  const studentUser = User.create({
    schoolId,
    role: 'STUDENT',
    email,
    phone,
    firstName: row.prenom.trim(),
    lastName: row.nom.trim(),
  });

  await deps.userRepository.saveAvecProfil(studentUser, {
    passwordHash,
    classeId,
    dateOfBirth,
    gender,
    parentOfStudentIds: parentUserId ? [parentUserId] : [],
  });

  const pebsVal = row.pebs?.trim().toUpperCase() ?? '';
  const lv2Val = row.lv2?.trim() ?? '';
  let importedProfileId: string | undefined;
  const syncRepos = {
    anneeRepository: deps.anneeRepository,
    groupSetRepository: deps.groupSetRepository,
    groupRepository: deps.groupRepository,
    membershipRepository: deps.membershipRepository,
  };

  // Écrire PEBS et LV2 dans un seul appel (atomicité native — single UPDATE SQL)
  if (pebsVal || lv2Val) {
    importedProfileId = await deps.importRepository.findStudentProfileId(studentUser.id) ?? undefined;

    let resolvedPebs: PebsFiliere | null = null;
    let resolvedLv2: string | null = null;

    if (pebsVal) {
      if (!['FR_PEBS', 'EN_PEBS'].includes(pebsVal)) {
        throw new Error(`Valeur PEBS invalide : "${pebsVal}" (attendu FR_PEBS ou EN_PEBS)`);
      }
      resolvedPebs = pebsVal as PebsFiliere;
    }

    if (lv2Val) {
      const subjectId = lv2NameToId.get(lv2Val.toLowerCase().trim());
      if (!subjectId) {
        throw new Error(`Langue LV2 introuvable : "${lv2Val}" — consultez la liste des langues disponibles dans votre établissement`);
      }
      resolvedLv2 = subjectId;
    }

    // Un seul UPDATEMany = atomicité garantie (pas de transaction nécessaire)
    await deps.importRepository.updatePeBSAndLv2(studentUser.id, resolvedPebs, resolvedLv2);

    // Sync StudentGroupMembership (opérations idempotentes, hors écriture principale)
    if (resolvedPebs && importedProfileId) {
      await synchroniserAppartenanceProgramme(syncRepos, { schoolId, studentProfileId: importedProfileId, pebsFiliere: resolvedPebs });
    }
    if (resolvedLv2 && importedProfileId) {
      await synchroniserAppartenanceLV2(syncRepos, { schoolId, studentProfileId: importedProfileId, lv2SubjectId: resolvedLv2 });
    }
  }

  if (isDevMode) {
    await envoyerEmailDevMode(deps.emailService, email || '', row.prenom.trim(), row.nom.trim(), schoolId, schoolName).catch(() => {});
  } else {
    await envoyerEmailLienInvitation(deps.emailService, studentUser.id, email || '', row.prenom.trim(), row.nom.trim(), schoolId, schoolName).catch(() => {});
  }
}

function parserSexe(sexe?: string): string | undefined {
  const v = sexe?.trim().toUpperCase();
  if (!v) return undefined;
  if (['F', 'FEMALE', 'FEMININ', 'FÉMININ', 'FEMME', 'FILLE'].includes(v)) return 'F';
  if (['M', 'MALE', 'MASCULIN', 'HOMME', 'GARCON', 'GARÇON'].includes(v)) return 'M';
  throw new Error(`Valeur sexe invalide : "${sexe}" (attendu M ou F)`);
}

function parserDate(dateStr: string): Date {
  const d = parseDateFR(dateStr);
  if (!d) {
    throw new Error(`Date invalide : "${dateStr}" (attendu JJ/MM/AAAA ou AAAA-MM-JJ)`);
  }
  return d;
}