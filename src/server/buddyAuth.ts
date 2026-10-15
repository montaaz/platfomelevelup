import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { toCtx, isAccountActive, type Ctx } from "@/server/context";

/** Authentification et anti-abus partagés par les routes de l'assistant (/api/buddy/*). */
export const MAX_CHARS = 1500;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

/** Anti-abus : au plus 30 messages par minute et par compte (mémoire du process). */
const hits = new Map<string, number[]>();
export function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return false;
}

/** Requête venue d'un autre site : refusée, le cookie de session ne doit pas servir ailleurs. */
function crossOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

/** Session valide et compte actif, ou la réponse d'erreur à renvoyer. */
export async function authenticate(req: NextRequest): Promise<{ ctx: Ctx } | { error: NextResponse }> {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Non authentifié." }, { status: 401 }) };
  const ctx = toCtx(session);
  if (!(await isAccountActive(ctx.userId))) {
    return { error: NextResponse.json({ error: "Compte désactivé." }, { status: 403 }) };
  }
  if (crossOrigin(req)) return { error: NextResponse.json({ error: "Origine refusée." }, { status: 403 }) };
  return { ctx };
}

