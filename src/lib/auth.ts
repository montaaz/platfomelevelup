import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 12);
}

export type LoginResult =
  | { ok: true; user: { id: bigint; role: "ADMIN" | "CLIENT"; clientId: bigint | null; fullName: string; email: string } }
  | { ok: false; reason: "INVALID" | "LOCKED" | "INACTIVE" };

/** Verifies credentials with brute-force lockout. Never reveals which part failed. */
export async function verifyLogin(email: string, password: string, ip?: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    // constant-time-ish: still run a hash comparison so timing doesn't leak account existence
    await bcrypt.compare(password, "$2a$12$C6UzMDM.H6dfI/f/IKcEeO7ZBpDLhEjkX0VwFOG8HcMYJHhcQfz2u");
    return { ok: false, reason: "INVALID" };
  }
  if (!user.isActive) return { ok: false, reason: "INACTIVE" };
  if (user.lockedUntil && user.lockedUntil > new Date()) return { ok: false, reason: "LOCKED" };

  const valid = await bcrypt.compare(password, user.passwordHash);

  if (!valid) {
    const attempts = user.failedLoginAttempts + 1;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    return { ok: false, reason: "INVALID" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
  await prisma.auditLog.create({
    data: { userId: user.id, action: "LOGIN", ipAddress: ip ?? null },
  });

  return {
    ok: true,
    user: { id: user.id, role: user.role, clientId: user.clientId, fullName: user.fullName, email: user.email },
  };
}
