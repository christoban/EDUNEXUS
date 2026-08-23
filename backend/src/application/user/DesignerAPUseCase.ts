/**
 * APPLICATION LAYER — Use Case : Désigner ou retirer la désignation AP
 * Un enseignant (TEACHER) peut être désigné Animateur Pédagogique (AP / HOD).
 * Mécanisme : création d'un StaffProfile avec les permissions AP + mise à jour
 * de TeacherProfile.supervisedSubjectIds.
 */
import type { PrismaClient } from '@prisma/client';
import { getPermissionsPourTitre } from '@domain/rules/StaffPermissionRules';
import { logActivity } from '../../infrastructure/services/audit/ActivityLogService';

export interface DesignerAPCommande {
  userId: string;
  schoolId: string;
  demandeurRole: string;
  departmentSubjectIds: string[];
  action: 'ASSIGN' | 'REMOVE';
}

export class DesignerAPUseCase {
  constructor(private readonly prisma: PrismaClient) {}

  async execute(commande: DesignerAPCommande): Promise<void> {
    if (commande.demandeurRole !== 'ADMIN') {
      throw new Error('Accès refusé : seul un Admin peut désigner un Animateur Pédagogique');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: commande.userId },
      select: { id: true, role: true, schoolId: true, firstName: true, lastName: true },
    });

    if (!user) throw new Error('Utilisateur introuvable');
    if (user.schoolId !== commande.schoolId) {
      throw new Error("Accès refusé : cet utilisateur n'appartient pas à votre établissement");
    }
    if (user.role !== 'TEACHER') {
      throw new Error(
        `"${user.firstName} ${user.lastName}" n'est pas un enseignant — seul un TEACHER peut être désigné AP`
      );
    }

    const apPermissions = getPermissionsPourTitre('Animateur Pédagogique');

    if (commande.action === 'ASSIGN') {
      // Upsert StaffProfile avec les permissions AP
      const existingProfile = await this.prisma.staffProfile.findUnique({
        where: { userId: commande.userId },
      });

      if (existingProfile) {
        // Ajouter les permissions AP manquantes
        const existingPerms = await this.prisma.staffPermission.findMany({
          where: { staffProfileId: existingProfile.id },
          select: { permission: true },
        });
        const existingPermSet = new Set(existingPerms.map(p => p.permission));
        const toAdd = apPermissions.filter(p => !existingPermSet.has(p));

        if (toAdd.length > 0) {
          await this.prisma.staffPermission.createMany({
            data: toAdd.map(permission => ({
              staffProfileId: existingProfile.id,
              permission,
            })),
            skipDuplicates: true,
          });
        }
      } else {
        // Créer un StaffProfile dédié AP pour cet enseignant
        const profile = await this.prisma.staffProfile.create({
          data: {
            schoolId: commande.schoolId,
            userId: commande.userId,
            title: 'Animateur Pédagogique',
          },
        });
        await this.prisma.staffPermission.createMany({
          data: apPermissions.map(permission => ({
            staffProfileId: profile.id,
            permission,
          })),
          skipDuplicates: true,
        });
      }

      // Mettre à jour les matières supervisées
      await this.prisma.teacherProfile.update({
        where: { userId: commande.userId },
        data: { supervisedSubjectIds: commande.departmentSubjectIds },
      });

      void logActivity({
        userId: commande.userId,
        schoolId: commande.schoolId,
        action: 'Permission AP assignée',
        details: JSON.stringify({ userId: commande.userId, permissions: apPermissions, departmentSubjectIds: commande.departmentSubjectIds }),
      });
    } else {
      // REMOVE — retirer les permissions AP du StaffProfile
      const profile = await this.prisma.staffProfile.findUnique({
        where: { userId: commande.userId },
        include: { permissions: true },
      });

      if (profile) {
        await this.prisma.staffPermission.deleteMany({
          where: {
            staffProfileId: profile.id,
            permission: { in: apPermissions },
          },
        });

        // Si plus aucune permission, supprimer le profil entier
        const remaining = await this.prisma.staffPermission.count({
          where: { staffProfileId: profile.id },
        });
        if (remaining === 0) {
          await this.prisma.staffProfile.delete({ where: { id: profile.id } });
        }
      }

      // Vider les matières supervisées
      await this.prisma.teacherProfile.update({
        where: { userId: commande.userId },
        data: { supervisedSubjectIds: [] },
      });

      void logActivity({
        userId: commande.userId,
        schoolId: commande.schoolId,
        action: 'Permission AP retirée',
        details: JSON.stringify({ userId: commande.userId }),
      });
    }
  }
}
