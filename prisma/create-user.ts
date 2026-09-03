/**
 * Bootstrap CLI — creates ONE login account from arguments (nothing hardcoded).
 * Normal account management happens in the app: Équipe → Comptes de connexion.
 *
 *   npx tsx prisma/create-user.ts <email> <nom complet> <mot de passe> [ADMIN|CLIENT] [clientId]
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const [email, fullName, password, role = "ADMIN", clientId] = process.argv.slice(2);
if (!email || !fullName || !password) {
  console.error("Usage: npx tsx prisma/create-user.ts <email> <nom> <mot de passe> [ADMIN|CLIENT] [clientId]");
  process.exit(1);
}
if (password.length < 8) {
  console.error("Le mot de passe doit contenir au moins 8 caractères.");
  process.exit(1);
}
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.create({
    data: {
      role: role === "CLIENT" ? "CLIENT" : "ADMIN",
      clientId: role === "CLIENT" ? BigInt(clientId ?? 0) : null,
      fullName,
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  console.log(`Compte créé: ${user.email} (${user.role}), id ${user.id}`);
}
main().finally(() => prisma.$disconnect());
