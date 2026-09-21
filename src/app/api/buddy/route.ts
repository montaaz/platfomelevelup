import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { toCtx, isAccountActive } from "@/server/context";
import { answerBuddy } from "@/buddy/answer";
import { prismaDataSource } from "@/buddy/data/prisma";
import { SUGGESTIONS } from "@/buddy/intents";

/**
 * Point d'entrée du Dashboard Buddy.
 *
 * L'identité vient de la session — jamais du corps de la requête — et un
 * compte bloqué est refusé ici comme partout ailleurs. Le message est traité
 * par le routeur d'intentions sans modèle ; rien ne sort du serveur.
 */

const MAX_CHARS = 1500;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

/** Anti-abus : au plus 30 messages par minute et par compte (mémoire du process). */
const hits = new Map<string, number[]>();
function rateLimited(key: string): boolean {
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

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  const ctx = toCtx(session);
  if (!(await isAccountActive(ctx.userId))) {
    return NextResponse.json({ error: "Compte désactivé." }, { status: 403 });
  }
  if (crossOrigin(req)) return NextResponse.json({ error: "Origine refusée." }, { status: 403 });
  if (rateLimited(ctx.userId.toString())) {
    return NextResponse.json({ error: "Trop de messages. Patientez une minute." }, { status: 429 });
  }

  let body: { message?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_CHARS) : "";
  if (!message) return NextResponse.json({ error: "Message vide." }, { status: 400 });

  try {
    const result = await answerBuddy(ctx, message, prismaDataSource);
    return NextResponse.json(result);
  } catch (e) {
    // Le détail va au journal, jamais au navigateur.
    console.error("[buddy]", e);
    return NextResponse.json(
      { kind: "refusal", text: "Je n'ai pas pu lire vos données. Réessayez dans un instant.", suggestions: SUGGESTIONS[ctx.role] },
      { status: 200 },
    );
  }
}
