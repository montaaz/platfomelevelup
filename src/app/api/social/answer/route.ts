import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { answerSocial, CHANNELS } from "@/server/services/socialBrain";

/**
 * Point d'entrée de n8n : un message reçu sur un réseau social ou par e-mail
 * entre, la réponse de l'assistant sort. Protégé par un jeton partagé
 * (SOCIAL_WEBHOOK_TOKEN, en-tête `x-social-token`) : sans lui, 401.
 */
const Input = z.object({
  channel: z.enum(CHANNELS),
  // vide autorisé : une note vocale ou une photo peut arriver sans texte
  message: z.string().max(4000).default(""),
  externalId: z.string().max(160).nullish(),
  displayName: z.string().max(160).nullish(),
  contact: z.string().max(254).nullish(),
  threadRef: z.string().max(160).nullish(),
  lang: z.enum(["fr", "en"]).nullish(),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).max(20).optional(),
  attachments: z.array(z.object({
    kind: z.enum(["audio", "image"]),
    mimeType: z.string().max(80).nullish(),
    base64: z.string().max(12_000_000).nullish(),
    url: z.string().url().max(2000).nullish(),
  })).max(3).optional(),
  wantVoice: z.boolean().optional(),
});

function authorized(req: NextRequest): boolean {
  const expected = process.env.SOCIAL_WEBHOOK_TOKEN ?? "";
  const given = req.headers.get("x-social-token") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (expected.length < 16 || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  const parsed = Input.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  try {
    return NextResponse.json(await answerSocial(parsed.data));
  } catch (e) {
    console.error("[social] réponse impossible:", e);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
