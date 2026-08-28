import bcrypt from 'bcryptjs';
import { User } from '@domain/entities/User';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { StudentGroupSetRepository } from '@domain/ports/repositories/StudentGroupSetRepository';
import type { StudentGroupRepository } from '@domain/ports/repositories/StudentGroupRepository';
import type { StudentGroupMembershipRepository } from '@domain/ports/repositories/StudentGroupMembershipRepository';
import type { ImportUtilisateursRepository } from '@domain/ports/repositories/ImportUtilisateursRepository';
import type { EmailService } from '@domain/ports/services/EmailService';
import { synchroniserAppartenanceLV2, synchroniserAppartenanceProgramme } from '@application/studentGroup/syncGroupMembership';
import { parseDateFR } from '../../shared/date/parseDateFR';
export interface ImportRow {
  ligne: number
  nom: string
  prenom: string
  email?: string
  telephone?: string
  matricule?: string
  dateNaissance?: string
  sexe?: string
  classe?: string
  nomParent?: string
  prenomParent?: string
  emailParent?: string
  telephoneParent?: string
  matieres?: string
  classePrincipale?: string
  pebs?: string
  lv2?: string
}

export interface ImportErreur {
  ligne: number
  erreur: string
}

export interface ImportWarning {
  ligne: number
  avertissement: string
}

export interface ImportResultat {
  total: number
  success: number
  professeursPrincipauxAssignes: number
  affectationsPedagogiquesPreremplies: number
  errors: ImportErreur[]
  warnings: ImportWarning[]
}

const DEV_PASS = 'chris123456789'

export class ImporterUtilisateursUseCase {
  constructor(
    private readonly importRepository: ImportUtilisateursRepository,
    private readonly userRepository: UserRepository,
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly groupSetRepository: StudentGroupSetRepository,
    private readonly groupRepository: StudentGroupRepository,
    private readonly membershipRepository: StudentGroupMembershipRepository,
    private readonly emailService: EmailService,
  ) {}

  async execute(
    schoolId: string,
    rows: ImportRow[],
    role: 'STUDENT' | 'TEACHER',
  ): Promise<ImportResultat> {
    const errors: ImportErreur[] = []
    const warnings: ImportWarning[] = []
    let success = 0
    let professeursPrincipauxAssignes = 0
    let affectationsPedagogiquesPreremplies = 0

    const isDevMode = process.env.EMAIL_DISABLED === 'true'

    // Dev : mot de passe fixe connu (chris123456789), cohérent avec l'invite individuelle
    // Prod : hash aléatoire — l'utilisateur DOIT passer par le lien d'invitation pour se connecter
    let sharedHash: string
    if (isDevMode) {
      sharedHash = await bcrypt.hash(DEV_PASS, 10)
    } else {
      const { randomBytes } = await import('crypto')
      sharedHash = await bcrypt.hash(randomBytes(32).toString('hex'), 10)
    }

    // Résoudre le nom de l'école une seule fois pour éviter N requêtes dans la boucle
    const contexte = await this.importRepository.chargerContexte(schoolId)
    const schoolName = contexte.schoolName

    // Cache classes : 1 requête pour toutes au lieu de 1 par ligne
    const classeCache = new Map(contexte.classes.map(c => [c.name, c.id]))

    // Cache LV2 subjects : nom → id
    const lv2NameToId = new Map<string, string>()
    for (const s of contexte.lv2Subjects) {
      lv2NameToId.set(s.name.toLowerCase().trim(), s.id)
    }
    const hasPEBS = contexte.hasPEBS

    for (const row of rows) {
      try {
        if (role === 'STUDENT') {
          await this.traiterLigneStudent(schoolId, row, sharedHash, isDevMode, schoolName, classeCache, lv2NameToId, hasPEBS)
        } else {
          const result = await this.traiterLigneTeacher(schoolId, row, sharedHash, isDevMode, schoolName, classeCache)
          if (result.ppAssigned) professeursPrincipauxAssignes++
          if (result.ppError) errors.push({ ligne: row.ligne, erreur: result.ppError })
          affectationsPedagogiquesPreremplies += result.affectationsCreees ?? 0
        }
        success++
      } catch (err) {
        errors.push({
          ligne: row.ligne,
          erreur: err instanceof Error ? err.message : 'Erreur inconnue',
        })
      }
    }

    return { total: rows.length, success, professeursPrincipauxAssignes, affectationsPedagogiquesPreremplies, errors, warnings }
  }

  private async traiterLigneStudent(schoolId: string, row: ImportRow, passwordHash: string, isDevMode: boolean, schoolName: string, classeCache: Map<string, string>, lv2NameToId: Map<string, string>, hasPEBS: boolean): Promise<void> {
    if (!row.nom?.trim()) throw new Error('Nom obligatoire')
    if (!row.prenom?.trim()) throw new Error('Prénom obligatoire')

    const email = row.email?.trim().toLowerCase()
    const phone = row.telephone?.trim() || undefined
    if (!email && !phone) throw new Error('Email ou téléphone obligatoire')

    let classeId: string | undefined
    if (row.classe?.trim()) {
      classeId = classeCache.get(row.classe.trim())
      if (!classeId) throw new Error(`Classe "${row.classe.trim()}" introuvable`)
    }

    let dateOfBirth: Date | undefined
    if (row.dateNaissance?.trim()) {
      dateOfBirth = this.parserDate(row.dateNaissance.trim())
    }

    const gender = this.parserSexe(row.sexe)

    let parentUserId: string | undefined
    if (row.emailParent?.trim()) {
      const parentEmail = row.emailParent.trim().toLowerCase()
      const existingParentId = await this.importRepository.findParentParEmail(schoolId, parentEmail)
      if (existingParentId) {
        parentUserId = existingParentId
      } else {
        const parentUser = User.create({
          schoolId,
          role: 'PARENT',
          email: parentEmail,
          phone: row.telephoneParent?.trim() || undefined,
          firstName: row.prenomParent?.trim() || `Parent de ${row.prenom.trim()}`,
          lastName: row.nomParent?.trim() || row.nom.trim(),
        })
        await this.userRepository.saveAvecProfil(parentUser, {
          passwordHash,
        })
        parentUserId = parentUser.id
      }
    }

    const studentUser = User.create({
      schoolId,
      role: 'STUDENT',
      email,
      phone,
      firstName: row.prenom.trim(),
      lastName: row.nom.trim(),
    })

    await this.userRepository.saveAvecProfil(studentUser, {
      passwordHash,
      classeId,
      dateOfBirth,
      gender,
      parentOfStudentIds: parentUserId ? [parentUserId] : [],
    })

    // ── PEBS ──────────────────────────────────────────────────────────────────
    const pebsVal = row.pebs?.trim().toUpperCase() ?? ''
    const lv2Val = row.lv2?.trim() ?? ''
    let importedProfileId: string | undefined
    if (pebsVal || lv2Val) {
      importedProfileId = await this.importRepository.findStudentProfileId(studentUser.id) ?? undefined
    }
    const syncRepos = { anneeRepository: this.anneeRepository, groupSetRepository: this.groupSetRepository, groupRepository: this.groupRepository, membershipRepository: this.membershipRepository }

    if (pebsVal) {
      if (!['FR_PEBS', 'EN_PEBS'].includes(pebsVal)) {
        throw new Error(`Valeur PEBS invalide : "${row.pebs?.trim()}" (attendu FR_PEBS ou EN_PEBS)`)
      }
      await this.importRepository.updatePeBSFiliere(studentUser.id, pebsVal)
      if (importedProfileId) {
        await synchroniserAppartenanceProgramme(syncRepos, { schoolId, studentProfileId: importedProfileId, pebsFiliere: pebsVal })
      }
    }

    // ── LV2 ───────────────────────────────────────────────────────────────────
    if (lv2Val) {
      const subjectId = lv2NameToId.get(lv2Val.toLowerCase().trim())
      if (!subjectId) {
        throw new Error(`Langue LV2 introuvable : "${lv2Val}" — consultez la liste des langues disponibles dans votre établissement`)
      }
      await this.importRepository.updateLv2Subject(studentUser.id, subjectId)
      if (importedProfileId) {
        await synchroniserAppartenanceLV2(syncRepos, { schoolId, studentProfileId: importedProfileId, lv2SubjectId: subjectId })
      }
    }

    // Fire-and-forget : les emails ne bloquent pas la boucle d'import
    if (isDevMode) {
      this.envoyerEmailDevMode(email || '', row.prenom.trim(), row.nom.trim(), schoolId, schoolName).catch(() => {})
    } else {
      this.envoyerEmailLienInvitation(studentUser.id, email || '', row.prenom.trim(), row.nom.trim(), schoolId, schoolName).catch(() => {})
    }
  }

  private async traiterLigneTeacher(
    schoolId: string,
    row: ImportRow,
    passwordHash: string,
    isDevMode: boolean,
    schoolName: string,
    classeCache: Map<string, string>,
  ): Promise<{ ppAssigned: boolean; ppError?: string; affectationsCreees?: number }> {
    if (!row.nom?.trim()) throw new Error('Nom obligatoire')
    if (!row.prenom?.trim()) throw new Error('Prénom obligatoire')
    if (!row.email?.trim()) throw new Error('Email obligatoire pour les enseignants')

    const email = row.email.trim().toLowerCase()

    const existe = await this.userRepository.existsByEmail(email, schoolId)
    if (existe) throw new Error(`Email déjà utilisé`)

    let subjectIds: string[] = []
    if (row.matieres?.trim()) {
      const matiereNames = row.matieres.split(',').map(m => m.trim()).filter(Boolean)
      const found = await this.importRepository.findSubjectsParNoms(schoolId, matiereNames)
      const foundNames = new Set(found.map(s => s.name))
      const missing = matiereNames.filter(m => !foundNames.has(m))
      if (missing.length > 0) {
        throw new Error(`Matières introuvables : ${missing.join(', ')}`)
      }
      subjectIds = found.map(s => s.id)
    }

    const teacherUser = User.create({
      schoolId,
      role: 'TEACHER',
      email,
      phone: row.telephone?.trim() || undefined,
      firstName: row.prenom.trim(),
      lastName: row.nom.trim(),
    })

    await this.userRepository.saveAvecProfil(teacherUser, { passwordHash, subjectIds })

    // Fire-and-forget : les emails ne bloquent pas la boucle d'import
    if (isDevMode) {
      this.envoyerEmailDevMode(email, row.prenom.trim(), row.nom.trim(), schoolId, schoolName).catch(() => {})
    } else {
      this.envoyerEmailLienInvitation(teacherUser.id, email, row.prenom.trim(), row.nom.trim(), schoolId, schoolName).catch(() => {})
    }

    // ── Désignation PP ────────────────────────────────────────────────────
    let ppAssigned = false
    let ppError: string | undefined
    if (row.classePrincipale?.trim()) {
      const className = row.classePrincipale.trim()
      const classe = await this.importRepository.findClassePourPP(schoolId, className)
      if (!classe) {
        ppError = `Classe '${className}' introuvable pour classe_principale`
      } else if (classe.professorPrincipalId) {
        const ppName = await this.importRepository.findNomProfesseurPrincipal(classe.professorPrincipalId) ?? 'inconnu'
        ppError = `Classe '${className}' a déjà un Professeur Principal (${ppName})`
      } else {
        // Vérifier que cet enseignant n'est pas déjà PP d'une autre classe
        const autreClasse = await this.importRepository.findAutreClasseDePP(teacherUser.id, schoolId, classe.id)
        if (autreClasse) {
          ppError = `Cet enseignant est déjà Professeur Principal de '${autreClasse.name}'. Un enseignant ne peut être PP que d'une seule classe.`
        } else {
          await this.importRepository.assignerProfesseurPrincipal(classe.id, teacherUser.id)
          ppAssigned = true
        }
      }
    }

    // ── Pré-remplissage affectations pédagogiques ─────────────────────────
    // Si PP assigné ET matières connues : créer TeachingAssignment pour chaque
    // matière qui fait partie du programme de la classe_principale
    let affectationsCreees = 0
    if (ppAssigned && subjectIds.length > 0 && row.classePrincipale?.trim()) {
      const classe = await this.importRepository.findClasseProgramme(schoolId, row.classePrincipale.trim())
      if (classe) {
        // Matières du programme de cette classe (serie pour 2nd cycle, filiere pour 1er cycle)
        // + overrides spécifiques à la classe (ClassSubjectOverride)
        const codeSerie = classe.serie ?? classe.filiere ?? null
        const programmSubjectIds = new Set(
          await this.importRepository.findSubjectsDuProgramme(schoolId, classe.level, codeSerie, classe.id),
        )

        const subjectsInProgramme = subjectIds.filter(id => programmSubjectIds.has(id))
        if (subjectsInProgramme.length > 0) {
          affectationsCreees = await this.importRepository.creerAffectations(
            subjectsInProgramme.map(subjectId => ({
              classId: classe.id, subjectId, teacherId: teacherUser.id, schoolId,
              academicYearId: classe.academicYearId,
            })),
          )
        }
      }
    }

    return { ppAssigned, ppError, affectationsCreees }
  }

  // Normalise les variantes courantes (FR/EN) vers 'M' ou 'F', cohérent avec le reste
  // du backend (voir schoolDocuments/index.ts : gender === 'F' || gender === 'FEMALE').
  private parserSexe(sexe?: string): string | undefined {
    const v = sexe?.trim().toUpperCase()
    if (!v) return undefined
    if (['F', 'FEMALE', 'FEMININ', 'FÉMININ', 'FEMME', 'FILLE'].includes(v)) return 'F'
    if (['M', 'MALE', 'MASCULIN', 'HOMME', 'GARCON', 'GARÇON'].includes(v)) return 'M'
    throw new Error(`Valeur sexe invalide : "${sexe}" (attendu M ou F)`)
  }

  private parserDate(dateStr: string): Date {
    const d = parseDateFR(dateStr)
    if (!d) {
      throw new Error(`Date invalide : "${dateStr}" (attendu JJ/MM/AAAA ou AAAA-MM-JJ)`)
    }
    return d
  }

// Dev mode : juste logué en console, aucun email réel envoyé
  private async envoyerEmailDevMode(email: string, prenom: string, nom: string, schoolId: string, schoolName: string): Promise<void> {
    try {
      await this.emailService.envoyer({
        destinataire: email,
        sujet: `[DEV] Compte créé — ${schoolName}`,
        contenuHtml: `<p>Bonjour ${prenom} ${nom},</p><p>Votre compte a été créé. Mot de passe dev : <strong>${DEV_PASS}</strong></p>`,
        eventType: 'user_import',
        metadata: { schoolId },
      })
    } catch { /* non bloquant */ }
  }

// Prod : lien JWT valable 7 jours, l'utilisateur crée son propre mot de passe
  private async envoyerEmailLienInvitation(
    userId: string,
    email: string,
    prenom: string,
    nom: string,
    schoolId: string,
    schoolName: string,
  ): Promise<void> {
    try {
      const frontendUrl = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000'

      const jwt = await import('jsonwebtoken')
      const inviteToken = jwt.default.sign(
        { sub: userId, email, schoolId, type: 'user_invite' },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' },
      )
      const inviteUrl = `${frontendUrl}/invite/set-password?token=${inviteToken}`

      await this.emailService.envoyer({
        destinataire: email,
        sujet: `ZekoulABia — Créez votre mot de passe · ${schoolName}`,
        contenuHtml: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
            <div style="background:#1a2e1e;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:white;margin:0;font-size:20px;">🎓 ZekoulABia</h1>
            </div>
            <div style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e8e0d4;">
              <h2 style="color:#1a1209;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
              <p style="color:#6b5c45;font-size:15px;line-height:1.6;">
                Vous avez été invité(e) à rejoindre <strong>ZekoulABia — ${schoolName}</strong>.
                Cliquez sur le bouton ci-dessous pour créer votre mot de passe et accéder à votre espace.
              </p>
              <div style="text-align:center;margin:28px 0 16px;">
                <a href="${inviteUrl}" style="background:linear-gradient(135deg,#059669,#047857);color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">
                  🔑 Créer mon mot de passe
                </a>
              </div>
              <p style="color:#a89478;font-size:13px;text-align:center;">Ce lien expire dans 7 jours.</p>
              <hr style="border:none;border-top:1px solid #e8e0d4;margin:20px 0;" />
              <p style="color:#a89478;font-size:12px;margin:0;text-align:center;">
                ZekoulABia · Plateforme de gestion scolaire · Cameroun
              </p>
            </div>
          </div>
        `,
        contenuTexte: `ZekoulABia — Créez votre mot de passe · ${schoolName}`,
        eventType: 'user_import',
        metadata: { schoolId },
      })
    } catch { /* non bloquant */ }
  }
}
