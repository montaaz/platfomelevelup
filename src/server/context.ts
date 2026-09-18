import { prisma } from "@/lib/prisma";
import { getSession, type SessionPayload } from "@/lib/session";

/** Authenticated request context used by every service and resolver. */
export type Ctx = {
  userId: bigint;
  role: "ADMIN" | "CLIENT";
  clientId: bigint | null;
  fullName: string;
};

/** User-facing validation message — shown as-is by the API (never masked). */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Accès refusé.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function toCtx(session: SessionPayload): Ctx {
  return {
    userId: BigInt(session.userId),
    role: session.role,
    clientId: session.clientId ? BigInt(session.clientId) : null,
    fullName: session.fullName,
  };
}

/**
 * Un compte désactivé perd l'accès immédiatement, sans attendre l'expiration
 * de sa session.
 *
 * Le jeton de session est signé et donc fiable, mais il est figé : il ignore
 * qu'un administrateur vient de bloquer le compte. On confronte donc la
 * session à la base. Le résultat est gardé quelques secondes en mémoire pour
 * ne pas ajouter une requête à chaque appel, ce qui laisse au blocage un délai
 * de prise d'effet inférieur à la seconde de navigation suivante.
 */
const ACTIVE_TTL_MS = 10_000;
const activeCache = new Map<string, { active: boolean; until: number }>();

export async function isAccountActive(userId: bigint): Promise<boolean> {
  const key = userId.toString();
  const hit = activeCache.get(key);
  const now = Date.now();
  if (hit && hit.until > now) return hit.active;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isActive: true },
  });
  const active = user?.isActive ?? false;
  activeCache.set(key, { active, until: now + ACTIVE_TTL_MS });
  // Purge opportuniste : la table reste petite même après de longues sessions.
  if (activeCache.size > 500) {
    for (const [k, v] of activeCache) if (v.until <= now) activeCache.delete(k);
  }
  return active;
}

/** Vide le cache d'un compte : appelé dès qu'on bloque ou rétablit un accès. */
export function forgetAccountState(userId: bigint) {
  activeCache.delete(userId.toString());
}

/** For server components: returns the ctx or throws (middleware already guards). */
export async function requireCtx(role?: "ADMIN" | "CLIENT"): Promise<Ctx> {
  const session = await getSession();
  if (!session) throw new ForbiddenError("Session expirée.");
  const ctx = toCtx(session);
  if (role && ctx.role !== role) throw new ForbiddenError();
  if (!(await isAccountActive(ctx.userId))) throw new ForbiddenError("Compte désactivé.");
  return ctx;
}

/**
 * Variante de `requireCtx` pour les pages qui ne vivent pas sous un layout
 * déjà gardé (/bienvenue, /paiement) : au lieu de laisser remonter une erreur
 * — qui donnerait un écran 500 — elle renvoie null, à charge pour la page de
 * rediriger vers la déconnexion.
 */
export async function ctxOrNull(role?: "ADMIN" | "CLIENT"): Promise<Ctx | null> {
  try {
    return await requireCtx(role);
  } catch {
    return null;
  }
}

export function assertAdmin(ctx: Ctx) {
  if (ctx.role !== "ADMIN") throw new ForbiddenError();
}

/** The client scope every client-side query MUST be filtered by. */
export function clientScope(ctx: Ctx): bigint {
  if (ctx.role !== "CLIENT" || ctx.clientId == null) throw new ForbiddenError();
  return ctx.clientId;
}
