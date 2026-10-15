import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/server/buddyAuth";
import { synthesizeSpeech } from "@/lib/baarchaMedia";

/** Phrases récurrentes (accueil de l'appel, formules) : audio gardé en mémoire pour ne pas repayer la synthèse. */
const cache = new Map<string, { audio: string; mimeType: string }>();
const CACHE_MAX = 40;

/** Voix de l'assistant (Baarcha « dido ») pour une réponse : audio opus en base64. */
export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if ("error" in auth) return auth.error;
  let body: { text?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.replace(/[*_#`✓→•]/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200) : "";
  if (!text) return NextResponse.json({ error: "Texte vide." }, { status: 400 });
  const hit = cache.get(text);
  if (hit) return NextResponse.json(hit);
  const voice = await synthesizeSpeech(text);
  if (!voice) return NextResponse.json({ error: "Voix indisponible pour le moment." }, { status: 503 });
  const out = { audio: voice.base64, mimeType: voice.mimeType };
  if (text.length <= 200) {
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
    cache.set(text, out);
  }
  return NextResponse.json(out);
}
