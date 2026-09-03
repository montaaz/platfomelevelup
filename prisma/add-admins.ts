/**
 * Adds/repairs admin accounts. Run: npx tsx prisma/add-admins.ts
 * Idempotent — an existing account keeps its password, only role/active are enforced.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const accounts = [
  { email: "wassim@levelupia.tn", fullName: "Wassim", password: "Wassim2026!" },
  { email: "chacha@levelupia.tn", fullName: "Chacha", password: "Chacha2026!" },
];

async function main() {
  for (const a of accounts) {
    const passwordHash = await bcrypt.hash(a.password, 12);
    await prisma.user.upsert({
      where: { email: a.email },
      create: { role: "ADMIN", fullName: a.fullName, email: a.email, passwordHash },
      update: { role: "ADMIN", isActive: true },
    });
    console.log("admin ready:", a.email);
  }
}

main().finally(() => prisma.$disconnect());
