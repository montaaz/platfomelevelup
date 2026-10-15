import { NextResponse, type NextRequest } from "next/server";
import { authenticate, rateLimited } from "@/server/buddyAuth";
import { buddyTurn } from "@/server/services/buddyChat";
import { baarchaMediaAvailable, transcribeAudio } from "@/lib/baarchaMedia";
import { tidyTranscript } from "@/lib/dictation";

/**
 * Un tour d'appel vocal : `message` (texte reconnu par le navigateur) ou
 * `audio` (enregistrement transcrit par Baarcha « fennec »), plus `context`.
 * Renvoie la même réponse que le chat (texte, proposition d'action), avec
 * `heard` = ce qui a été compris. La voix est produite à part (/speak) pour
 * afficher le texte sans attendre l'audio.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticate(req);
  if ("error" in auth) return auth.error;
  const { ctx } = auth;
  if (rateLimited(ctx.userId.toString())) return NextResponse.json({ error: "Trop de messages. Patientez une minute." }, { status: 429 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  let heard = String(form.get("message") ?? "").slice(0, 1500);
  const audio = form.get("audio");
  if (!heard && audio instanceof File && audio.size > 0) {
    if (audio.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Enregistrement trop long." }, { status: 400 });
    if (!/^audio\/|^video\/webm/.test(audio.type)) return NextResponse.json({ error: "Format audio non reconnu." }, { status: 400 });
    if (!baarchaMediaAvailable()) return NextResponse.json({ error: "Transcription indisponible : utilisez Chrome pour l'appel en direct." }, { status: 503 });
    heard = (await transcribeAudio(Buffer.from(await audio.arrayBuffer()), audio.type || "audio/webm")) ?? "";
    if (!heard) return NextResponse.json({ error: "Transcription Baarcha indisponible pour le moment (service ou crédit API). Réessayez dans un instant ou écrivez votre question." }, { status: 503 });
  }
  heard = tidyTranscript(heard);
  if (!heard) return NextResponse.json({ error: "Je n'ai rien entendu : parlez un peu plus fort, près du micro." }, { status: 422 });

  let context: unknown;
  try {
    context = form.get("context") ? JSON.parse(String(form.get("context"))) : undefined;
  } catch {
    context = undefined;
  }
  try {
    const reply = await buddyTurn(ctx, heard, context);
    return NextResponse.json({ ...reply, heard });
  } catch (e) {
    console.error("[buddy call]", e);
    return NextResponse.json({ error: "L'assistant n'a pas pu répondre. Réessayez." }, { status: 500 });
  }
}
