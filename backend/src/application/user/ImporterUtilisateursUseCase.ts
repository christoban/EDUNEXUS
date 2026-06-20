import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { User } from '@domain/entities/User';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';
export interface ImportRow {
  ligne: number
  nom: string
  prenom: string
  email?: string
  telephone?: string
  matricule?: string
  dateNaissance?: string
  classe?: string
  nomParent?: string
  prenomParent?: string
  emailParent?: string
  telephoneParent?: string
  matieres?: string
  classePrincipale?: string
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
    private readonly prisma: PrismaClient,
    private readonly userRepository: UserRepository,
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
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, subdomain: true } })
    const schoolName = school?.name ?? 'EduNexus'

    // Cache classes : 1 requête pour toutes au lieu de 1 par ligne
    const allClasses = await this.prisma.class.findMany({ where: { schoolId }, select: { id: true, name: true } })
    const classeCache = new Map(allClasses.map(c => [c.name, c.id]))

    for (const row of rows) {
      try {
        if (role === 'STUDENT') {
          await this.traiterLigneStudent(schoolId, row, sharedHash, isDevMode, schoolName, classeCache)
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

  private async traiterLigneStudent(schoolId: string, row: ImportRow, passwordHash: string, isDevMode: boolean, schoolName: string, classeCache: Map<string, string>): Promise<void> {
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

    let parentUserId: string | undefined
    if (row.emailParent?.trim()) {
      const parentEmail = row.emailParent.trim().toLowerCase()
      const existingParent = await this.prisma.user.findFirst({
        where: { schoolId, email: parentEmail, role: 'PARENT' },
        select: { id: true },
      })
      if (existingParent) {
        parentUserId = existingParent.id
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
      parentOfStudentIds: parentUserId ? [parentUserId] : [],
    })

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
      const found = await this.prisma.subject.findMany({
        where: { schoolId, name: { in: matiereNames } },
        select: { id: true, name: true },
      })
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
      const classe = await this.prisma.class.findFirst({
        where: { schoolId, name: className },
        select: { id: true, professorPrincipalId: true },
      })
      if (!classe) {
        ppError = `Classe '${className}' introuvable pour classe_principale`
      } else if (classe.professorPrincipalId) {
        const existingPP = await this.prisma.user.findUnique({
          where: { id: classe.professorPrincipalId },
          select: { firstName: true, lastName: true },
        })
        const ppName = existingPP ? `${existingPP.firstName} ${existingPP.lastName}` : 'inconnu'
        ppError = `Classe '${className}' a déjà un Professeur Principal (${ppName})`
      } else {
        await this.prisma.class.update({
          where: { id: classe.id },
          data: { professorPrincipalId: teacherUser.id },
        })
        ppAssigned = true
      }
    }

    // ── Pré-remplissage affectations pédagogiques ─────────────────────────
    // Si PP assigné ET matières connues : créer TeachingAssignment pour chaque
    // matière qui fait partie du programme de la classe_principale
    let affectationsCreees = 0
    if (ppAssigned && subjectIds.length > 0 && row.classePrincipale?.trim()) {
      const classe = await this.prisma.class.findFirst({
        where: { schoolId, name: row.classePrincipale.trim() },
        select: { id: true, level: true, serie: true, filiere: true },
      })
      if (classe) {
        // Matières du programme de cette classe (serie pour 2nd cycle, filiere pour 1er cycle)
        const codeSerie = classe.serie ?? classe.filiere ?? null
        const coefficients = await this.prisma.subjectCoefficient.findMany({
          where: {
            schoolId,
            classLevel: classe.level ?? undefined,
            OR: [{ serieCode: codeSerie }, { serieCode: null }],
          },
          select: { subjectId: true },
        })
        const programmSubjectIds = new Set(coefficients.map(c => c.subjectId))

        const subjectsInProgramme = subjectIds.filter(id => programmSubjectIds.has(id))
        if (subjectsInProgramme.length > 0) {
          const result = await this.prisma.teachingAssignment.createMany({
            data: subjectsInProgramme.map(subjectId => ({
              classId: classe.id, subjectId, teacherId: teacherUser.id, schoolId,
            })),
            skipDuplicates: true, // ignore si matière déjà affectée à quelqu'un d'autre
          })
          affectationsCreees = result.count
        }
      }
    }

    return { ppAssigned, ppError, affectationsCreees }
  }

  private parserDate(dateStr: string): Date {
    const parts = dateStr.split('/')
    if (parts.length !== 3) throw new Error(`Format de date invalide : "${dateStr}" (attendu JJ/MM/AAAA)`)
    const day = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10) - 1
    const year = parseInt(parts[2], 10)
    if (isNaN(day) || isNaN(month) || isNaN(year)) {
      throw new Error(`Date invalide : "${dateStr}"`)
    }
    const d = new Date(year, month, day)
    if (d.getDate() !== day || d.getMonth() !== month || d.getFullYear() !== year) {
      throw new Error(`Date invalide : "${dateStr}"`)
    }
    return d
  }

  // Dev mode : juste logué en console, aucun email réel envoyé
  private async envoyerEmailDevMode(email: string, prenom: string, nom: string, schoolId: string, schoolName: string): Promise<void> {
    try {
      const { sendTransactionalEmail } = await import('../../services/emailService')
      await sendTransactionalEmail({
        recipientEmail: email,
        subject: `[DEV] Compte créé — ${schoolName}`,
        html: `<p>Bonjour ${prenom} ${nom}, compte créé. Mot de passe dev : <strong>${DEV_PASS}</strong></p>`,
        template: 'user_invitation',
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

      console.log(`[Import] Lien invitation ${email}: ${inviteUrl}`)

      const { sendTransactionalEmail } = await import('../../services/emailService')
      await sendTransactionalEmail({
        recipientEmail: email,
        subject: `EduNexus — Créez votre mot de passe · ${schoolName}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
            <div style="background:#1a2e1e;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:white;margin:0;font-size:20px;">🎓 EduNexus</h1>
            </div>
            <div style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e8e0d4;">
              <h2 style="color:#1a1209;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
              <p style="color:#6b5c45;font-size:15px;line-height:1.6;">
                Vous avez été ajouté(e) sur <strong>EduNexus — ${schoolName}</strong>.
                Cliquez ci-dessous pour créer votre mot de passe et accéder à votre espace.
              </p>
              <div style="text-align:center;margin:28px 0 16px;">
                <a href="${inviteUrl}" style="background:linear-gradient(135deg,#059669,#047857);color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">
                  🔑 Créer mon mot de passe
                </a>
              </div>
              <p style="color:#a89478;font-size:13px;text-align:center;">Ce lien expire dans 7 jours.</p>
              <hr style="border:none;border-top:1px solid #e8e0d4;margin:20px 0;" />
              <p style="color:#a89478;font-size:12px;margin:0;text-align:center;">
                EduNexus · Plateforme de gestion scolaire · Cameroun
              </p>
            </div>
          </div>
        `,
        template: 'user_invitation',
        eventType: 'user_import',
        metadata: { schoolId },
      })
    } catch { /* non bloquant */ }
  }
}
