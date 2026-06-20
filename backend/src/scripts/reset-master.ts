import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const EMAIL = process.env.MASTER_ALLOWED_EMAILS?.split(",")[0]?.trim() || "christoban2005@gmail.com";
const PASSWORD = "EduNexusMaster2025!"; // Mot de passe temporaire à changer dès la première connexion

async function resetMaster() {
  console.log("🔄 Reset MasterUser en cours...");
  console.log(`📧 Email : ${EMAIL}`);

  // Supprimer l'existant s'il y en a un
  const existing = await prisma.masterUser.findUnique({ where: { email: EMAIL } });
  if (existing) {
    // Supprimer les logs d'audit liés
    await prisma.masterAuthAudit.deleteMany({ where: { masterUserId: existing.id } });
    // Supprimer les invitations liées
    await prisma.schoolInvite.updateMany({
      where: { invitedByMasterId: existing.id },
      data: { invitedByMasterId: null },
    });
    await prisma.masterUser.delete({ where: { email: EMAIL } });
    console.log("🗑️  Ancien MasterUser supprimé");
  }

  // Hasher le mot de passe
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  // Créer le nouveau MasterUser
  const master = await prisma.masterUser.create({
    data: {
      email: EMAIL,
      passwordHash,
      name: "Ndzana Christophe",
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
      isActive: true,
      mfaEnabled: false,      // MFA désactivée → à re-setup via l'interface
      mfaSecret: null,
      mfaTempSecret: null,
      mfaRecoveryCodeHashes: [],
    },
  });

  console.log("✅ MasterUser créé avec succès !");
  console.log("─────────────────────────────────");
  console.log(`📧 Email    : ${master.email}`);
  console.log(`🔑 Password : ${PASSWORD}`);
  console.log(`🛡️  MFA      : DÉSACTIVÉE (à re-activer dans /master/security)`);
  console.log(`🆔 ID       : ${master.id}`);
  console.log("─────────────────────────────────");
  console.log("⚠️  IMPORTANT : Change le mot de passe dès ta première connexion !");
  console.log("⚠️  IMPORTANT : Re-active la MFA dans /master/security !");

  await prisma.$disconnect();
}

resetMaster().catch((err) => {
  console.error("❌ Erreur lors du reset :", err);
  process.exit(1);
});
