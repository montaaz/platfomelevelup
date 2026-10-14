import { NextResponse, type NextRequest } from "next/server";
import { ctxOrNull } from "@/server/context";
import { baarchaMediaAvailable, transcribeAudio } from "@/lib/baarchaMedia";
import { baarchaModel, readBaarchaConfig } from "@/buddy/ai/model";
import { acceptCorrection, correctionPrompt, MAX_DICTATION_CHARS, tidyTranscript } from "@/lib/dictation";

/**
 * Dictée vocale d'un champ de formulaire.
 *
 * Entrée (multipart) : `hint` = texte reconnu par le navigateur (Web Speech),
 * `audio` = enregistrement (webm/ogg/mp4) pour la transcription Baarcha
 * « fennec », `context` = intitulé du champ, `lang` = fr | en | auto.
 * Sortie : { text, source } — le texte corrigé par le modèle Baarcha, ou le
 * texte brut si la correction n'est pas une simple correction.
 *
 * Sécurité : session obligatoire, audio limité à 8 Mo et jamais conservé,
 * 30 dictées par heure et par utilisateur, aucune donnée du navigateur ne
 * sert à construire une requête.
 */
const MAX_AUDIO = 8 * 1024 * 1024;
const perUser = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (perUser.get(userId) ?? []).filter((t) => now - t < 3_600_000);
  const limited = recent.length >= 30;
  if (!limited) recent.push(now);
  perUser.set(userId, recent);
  if (perUser.size > 5000) perUser.clear();
  return limited;
}

export async function POST(req: NextRequest) {
  const ctx = await ctxOrNull();
  if (!ctx) return NextResponse.json({ error: "Session expirée." }, { status: 401 });
  if (rateLimited(ctx.userId.toString())) return NextResponse.json({ error: "Trop de dictées en une heure. Réessayez plus tard." }, { status: 429 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const hint = String(form.get("hint") ?? "").slice(0, MAX_DICTATION_CHARS);
  const context = String(form.get("context") ?? "").replace(/[\r\n]+/g, " ").slice(0, 160) || null;
  const langRaw = String(form.get("lang") ?? "auto");
  const lang = langRaw === "fr" || langRaw === "en" ? langRaw : "auto";
  const audio = form.get("audio");

  // 1. Texte entendu : Baarcha « fennec » sur l'audio quand le service répond, sinon la reconnaissance du navigateur.
  let heard = "";
  let source = "navigateur";
  if (audio instanceof File && audio.size > 0) {
    if (audio.size > MAX_AUDIO) return NextResponse.json({ error: "Enregistrement trop long (8 Mo maximum)." }, { status: 400 });
    if (!/^audio\/|^video\/webm/.test(audio.type)) return NextResponse.json({ error: "Format audio non reconnu." }, { status: 400 });
    if (baarchaMediaAvailable()) {
      const t = await transcribeAudio(Buffer.from(await audio.arrayBuffer()), audio.type || "audio/webm");
      if (t) {
        heard = t;
        source = "baarcha-fennec";
      }
    }
  }
  if (!heard) heard = hint;
  heard = tidyTranscript(heard);
  if (!heard) {
    return NextResponse.json(
      { error: audio ? "Rien n'a été compris : parlez plus près du micro, ou utilisez Chrome pour la dictée en direct." : "Rien n'a été entendu." },
      { status: 422 },
    );
  }

  // 2. Correction par le modèle Baarcha (orthographe, grammaire, ponctuation), avec garde-fou.
  let text = heard;
  let corrected = false;
  const cfg = readBaarchaConfig();
  if (cfg) {
    try {
      const out = await baarchaModel(cfg).chat(
        [{ role: "system", content: correctionPrompt(context, lang) }, { role: "user", content: heard }],
        { maxTokens: Math.min(1200, Math.ceil(heard.length / 2) + 120), temperature: 0, timeoutMs: 25_000 },
      );
      const clean = out.trim().replace(/^["«\s]+|["»\s]+$/g, "");
      if (acceptCorrection(heard, clean)) {
        text = clean;
        corrected = true;
      }
    } catch (e) {
      console.warn("[dictée] correction indisponible:", e instanceof Error ? e.message : e);
    }
  }
  return NextResponse.json({ text, heard, corrected, source });
}
