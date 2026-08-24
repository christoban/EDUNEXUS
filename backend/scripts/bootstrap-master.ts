/**
 * ADMIN BOOTSTRAP — création one-shot du compte Master (premier déploiement).
 *
 * Sécurisé par design :
 *  - idempotent : refuse de s'exécuter si un MasterUser existe déjà (jamais de reset à volonté)
 *  - aucun secret dans le code : email lu depuis MASTER_ALLOWED_EMAILS, mot de passe depuis
 *    MASTER_RESET_PASSWORD (ou généré aléatoirement et affiché UNE seule fois)
 *  - le mot de passe n'est jamais écrit dans les logs sauf au moment de la création
 *
 * Usage : bun scripts/bootstrap-master.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required (voir backend/.env.example)`);
  }
  return value;
}

async function bootstrapMaster() {
  const email = process.env.MASTER_ALLOWED_EMAILS?.split(",")[0]?.trim() ?? requireEnv("MASTER_ALLOWED_EMAILS");

  // One-shot : refuser si le Master existe déjà — jamais de réinitialisation silencieuse.
  const existing = await prisma.masterUser.findUnique({ where: { email } });
  if (existing) {
    console.error("❌ Master account already exists. Bootstrap refused.");
    console.error("   Utilise la procédure de récupération prévue, pas ce script.");
    await prisma.$disconnect();
    process.exit(1);
  }

  // Mot de passe : variable d'env, sinon génération aléatoire affichée une seule fois.
  const password = process.env.MASTER_RESET_PASSWORD?.trim() || crypto.randomBytes(18).toString("base64url");
  const passwordHash = await bcrypt.hash(password, 12);

  const master = await prisma.masterUser.create({
    data: {
      email,
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

  console.log("✅ MasterUser créé avec succès.");
  console.log("─────────────────────────────────");
  console.log(`📧 Email : ${master.email}`);
  if (!process.env.MASTER_RESET_PASSWORD) {
    console.log(`🔑 Mot de passe temporaire : ${password}`);
  }
  console.log(`🆔 ID    : ${master.id}`);
  console.log("─────────────────────────────────");
  console.log("⚠️  IMPORTANT : change le mot de passe dès la première connexion.");
  console.log("⚠️  IMPORTANT : re-active la MFA dans /master/security.");

  await prisma.$disconnect();
}

bootstrapMaster().catch((err) => {
  console.error("❌ Erreur lors du bootstrap :", err instanceof Error ? err.message : err);
  process.exit(1);
});