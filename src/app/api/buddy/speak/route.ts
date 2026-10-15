import { NextResponse, type NextRequest } from "next/server";
import { authenticate } from "@/server/buddyAuth";
import { synthesizeSpeech } from "@/lib/baarchaMedia";

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
  const voice = await synthesizeSpeech(text);
  if (!voice) return NextResponse.json({ error: "Voix indisponible pour le moment." }, { status: 503 });
  return NextResponse.json({ audio: voice.base64, mimeType: voice.mimeType });
}
