import { NextResponse, type NextRequest } from "next/server";
import { buddyTurn } from "@/server/services/buddyChat";
import { authenticate, MAX_CHARS, rateLimited } from "@/server/buddyAuth";
import { L } from "@/buddy/locales";
import { detectLanguage } from "@/buddy/core/language";
import { clearMyHistory, myHistory } from "@/buddy/history";

/**
 * Point d'entrée du Dashboard Buddy.
 *
 * L'identité vient de la session — jamais du corps de la requête — et un
 * compte bloqué est refusé ici comme partout ailleurs. Le message est traité
 * par le routeur d'intentions ; quand BUDDY_AI=on, le modèle local (Ollama,
 * sur ce serveur) prend le relais de ce que les règles ne comprennent pas.
 * Rien ne sort du serveur. Chaque
 * échange est conservé : GET rend le fil du compte, DELETE l'efface.
 */

export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (rateLimited(ctx.userId.toString())) {
    return NextResponse.json({ error: "Trop de messages. Patientez une minute." }, { status: 429 });
  }

  let body: { message?: unknown; context?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const message = typeof body.message === "string" ? body.message.trim().slice(0, MAX_CHARS) : "";
  if (!message) return NextResponse.json({ error: "Message vide." }, { status: 400 });

  try {
    return NextResponse.json(await buddyTurn(ctx, message, body.context));
  } catch (e) {
    // Le détail va au journal, jamais au navigateur.
    console.error("[buddy]", e);
    const lang = detectLanguage(message, "fr");
    return NextResponse.json({ kind: "refusal", lang, text: L(lang).serverError, suggestions: L(lang).suggestions(ctx.role) }, { status: 200 });
  }
}

/** Le fil du compte connecté, pour le rouvrir là où il en était. */
export async function GET(req: NextRequest) {
  const auth = await authenticate(req);
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await myHistory(auth.ctx));
  } catch (e) {
    console.error("[buddy] historique illisible:", e);
    return NextResponse.json({ messages: [] });
  }
}

/** Efface le fil du compte connecté — le sien uniquement. */
export async function DELETE(req: NextRequest) {
  const auth = await authenticate(req);
  if ("error" in auth) return auth.error;
  const deleted = await clearMyHistory(auth.ctx);
  return NextResponse.json({ deleted });
}
