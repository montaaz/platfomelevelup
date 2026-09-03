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

/** For server components: returns the ctx or throws (middleware already guards). */
export async function requireCtx(role?: "ADMIN" | "CLIENT"): Promise<Ctx> {
  const session = await getSession();
  if (!session) throw new ForbiddenError("Session expirée.");
  const ctx = toCtx(session);
  if (role && ctx.role !== role) throw new ForbiddenError();
  return ctx;
}

export function assertAdmin(ctx: Ctx) {
  if (ctx.role !== "ADMIN") throw new ForbiddenError();
}

/** The client scope every client-side query MUST be filtered by. */
export function clientScope(ctx: Ctx): bigint {
  if (ctx.role !== "CLIENT" || ctx.clientId == null) throw new ForbiddenError();
  return ctx.clientId;
}
