import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ValidationError } from "@/server/context";

/**
 * Inscription publique : crée un client (entreprise) + son compte de connexion.
 * Rôle CLIENT uniquement — jamais ADMIN, qui se crée depuis Équipe → Comptes.
 */
export type SignupInput = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signupClient(input: SignupInput) {
  const fullName = input.fullName?.trim() ?? "";
  const email = input.email?.trim().toLowerCase() ?? "";
  const password = input.password ?? "";

  if (fullName.length < 2 || fullName.length > 160) {
    throw new ValidationError("Merci d'indiquer votre nom complet.");
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    throw new ValidationError("Adresse e-mail invalide.");
  }
  if (password.length < 8) {
    throw new ValidationError("Le mot de passe doit contenir au moins 8 caractères.");
  }
  if (password.length > 200) {
    throw new ValidationError("Mot de passe trop long.");
  }
  if (password !== input.confirmPassword) {
    throw new ValidationError("Les deux mots de passe ne correspondent pas.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    // client + compte créés ensemble : jamais de compte orphelin
    const user = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: { companyName: fullName, contactName: fullName, email },
      });
      return tx.user.create({
        data: { role: "CLIENT", clientId: client.id, fullName, email, passwordHash },
      });
    });

    await prisma.auditLog.create({
      data: { userId: user.id, action: "SIGNUP", entityType: "user", entityId: user.id },
    });

    return {
      id: user.id.toString(),
      role: user.role,
      clientId: user.clientId?.toString() ?? null,
      fullName: user.fullName,
      email: user.email,
    };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ValidationError("Un compte existe déjà avec cette adresse e-mail.");
    }
    throw e;
  }
}
