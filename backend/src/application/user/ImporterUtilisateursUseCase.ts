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
  emailParent?: string
  telephoneParent?: string
  matieres?: string
}

export interface ImportErreur {
  ligne: number
  erreur: string
}

export interface ImportResultat {
  total: number
  success: number
  errors: ImportErreur[]
}

const PASS_TEMPORAIRE = 'EduNexus2025!'

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
    let success = 0

    for (const row of rows) {
      try {
        if (role === 'STUDENT') {
          await this.traiterLigneStudent(schoolId, row)
        } else {
          await this.traiterLigneTeacher(schoolId, row)
        }
        success++
      } catch (err) {
        errors.push({
          ligne: row.ligne,
          erreur: err instanceof Error ? err.message : 'Erreur inconnue',
        })
      }
    }

    return { total: rows.length, success, errors }
  }

  private async traiterLigneStudent(schoolId: string, row: ImportRow): Promise<void> {
    if (!row.nom?.trim()) throw new Error('Nom obligatoire')
    if (!row.prenom?.trim()) throw new Error('Prénom obligatoire')

    const email = row.email?.trim().toLowerCase()
    const phone = row.telephone?.trim()
    if (!email && !phone) throw new Error('Email ou téléphone obligatoire')

    const passwordHash = await bcrypt.hash(PASS_TEMPORAIRE, 10)

    let classeId: string | undefined
    if (row.classe?.trim()) {
      const classe = await this.prisma.class.findFirst({
        where: { schoolId, name: row.classe.trim() },
        select: { id: true },
      })
      if (!classe) throw new Error(`Classe "${row.classe.trim()}" introuvable`)
      classeId = classe.id
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
        const parentPwd = await bcrypt.hash(PASS_TEMPORAIRE, 10)
        const parentUser = User.create({
          schoolId,
          role: 'PARENT',
          email: parentEmail,
          phone: row.telephoneParent?.trim() || undefined,
          firstName: `Parent ${row.prenom.trim()}`,
          lastName: row.nom.trim(),
        })
        await this.userRepository.saveAvecProfil(parentUser, {
          passwordHash: parentPwd,
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

    await this.envoyerEmailInvitation(
      email || '',
      row.prenom.trim(),
      row.nom.trim(),
      schoolId,
      PASS_TEMPORAIRE,
    )
  }

  private async traiterLigneTeacher(schoolId: string, row: ImportRow): Promise<void> {
    if (!row.nom?.trim()) throw new Error('Nom obligatoire')
    if (!row.prenom?.trim()) throw new Error('Prénom obligatoire')
    if (!row.email?.trim()) throw new Error('Email obligatoire pour les enseignants')

    const email = row.email.trim().toLowerCase()

    const existe = await this.userRepository.existsByEmail(email, schoolId)
    if (existe) throw new Error(`Email déjà utilisé`)

    const passwordHash = await bcrypt.hash(PASS_TEMPORAIRE, 10)

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

    await this.userRepository.saveAvecProfil(teacherUser, {
      passwordHash,
      subjectIds,
    })

    await this.envoyerEmailInvitation(
      email,
      row.prenom.trim(),
      row.nom.trim(),
      schoolId,
      PASS_TEMPORAIRE,
    )
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

  private async envoyerEmailInvitation(
    email: string,
    prenom: string,
    nom: string,
    schoolId: string,
    motDePasse: string,
  ): Promise<void> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, subdomain: true },
    })
    const schoolName = school?.name ?? 'votre établissement'
    const loginUrl = `${process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:3000'}/login?subdomain=${encodeURIComponent(school?.subdomain ?? '')}`

    try {
      const { sendTransactionalEmail } = await import('../../services/emailService')
      await sendTransactionalEmail({
        recipientEmail: email,
        subject: `Bienvenue sur EduNexus — ${schoolName}`,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
            <div style="background:#1a2e1e;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
              <h1 style="color:white;margin:0;font-size:20px;">🎓 EduNexus</h1>
            </div>
            <div style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e8e0d4;">
              <h2 style="color:#1a1209;margin-top:0;">Bonjour ${prenom} ${nom},</h2>
              <p style="color:#6b5c45;font-size:15px;line-height:1.6;">
                Votre compte a été créé sur <strong>EduNexus — ${schoolName}</strong>.
              </p>
              <div style="background:#f0fdf4;padding:18px 22px;border-radius:10px;margin:20px 0;">
                <div style="font-size:13px;color:#065f46;font-weight:600;">Identifiant :</div>
                <div style="font-size:18px;color:#059669;font-weight:800;margin-top:4px;">${email}</div>
                <div style="font-size:13px;color:#065f46;font-weight:600;margin-top:12px;">Mot de passe temporaire :</div>
                <div style="font-size:18px;color:#059669;font-weight:800;margin-top:4px;font-family:monospace;">${motDePasse}</div>
              </div>
              <p style="color:#6b5c45;font-size:14px;">Connectez-vous et modifiez votre mot de passe dès la première connexion.</p>
              <div style="text-align:center;margin:28px 0 16px;">
                <a href="${loginUrl}" style="background:linear-gradient(135deg,#059669,#047857);color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">
                  🚀 Accéder à mon espace
                </a>
              </div>
              <hr style="border:none;border-top:1px solid #e8e0d4;margin:20px 0;" />
              <p style="color:#a89478;font-size:12px;margin:0;">
                EduNexus · Plateforme de gestion scolaire · Cameroun
              </p>
            </div>
          </div>
        `,
        template: 'user_invitation',
        eventType: 'user_import',
      })
    } catch {
      // Échec d'envoi email — non bloquant
    }
  }
}
