import { readBaarchaConfig } from "@/buddy/ai/model";

/**
 * Les autres talents de Baarcha, au service des réseaux sociaux :
 *  - Fennec  : transcription de la voix (tunisien, français, mélange des deux) ;
 *  - Dido    : synthèse vocale (réponse en note vocale) ;
 *  - Hannibal : compréhension d'image (photo d'une boutique, d'un produit, d'un logo).
 * Chaque fonction renvoie null en cas d'indisponibilité : l'assistant continue en texte.
 */

const TIMEOUT = 60_000;

function cfg() {
  return readBaarchaConfig();
}

export function baarchaMediaAvailable(): boolean {
  return cfg() !== null;
}

/** Note vocale → texte. */
export async function transcribeAudio(bytes: Buffer, mimeType: string): Promise<string | null> {
  const c = cfg();
  if (!c) return null;
  try {
    const form = new FormData();
    const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" : mimeType.includes("wav") ? "wav" : "mp3";
    form.set("file", new Blob([new Uint8Array(bytes)], { type: mimeType.split(";")[0] }), `vocal.${ext}`);
    form.set("model", "fennec");
    const res = await fetch(`${c.url}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) throw new Error(`Baarcha transcription ${res.status}`);
    const data = (await res.json()) as { text?: string };
    const text = data.text?.trim() ?? "";
    return text || null;
  } catch (e) {
    console.warn("[baarcha] transcription indisponible:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Texte → note vocale (opus, lisible comme vocal WhatsApp). */
export async function synthesizeSpeech(text: string, voice = process.env.BAARCHA_VOICE || "female"): Promise<{ base64: string; mimeType: string } | null> {
  const c = cfg();
  if (!c) return null;
  // Les liens et emojis ne se prononcent pas : on les retire de la version parlée.
  const spoken = text.replace(/https?:\/\/\S+/g, "").replace(/[👉🔥🌤❄️🙋✅⏳💳🤖]/gu, "").replace(/\s+/g, " ").trim().slice(0, 1200);
  if (spoken.length < 2) return null;
  try {
    const res = await fetch(`${c.url}/audio/speech`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "dido", input: spoken, voice, response_format: "opus" }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) throw new Error(`Baarcha speech ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 100) return null;
    return { base64: buf.toString("base64"), mimeType: "audio/ogg; codecs=opus" };
  } catch (e) {
    console.warn("[baarcha] synthèse vocale indisponible:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Photo reçue → description courte orientée business (ce que montre l'image, pour orienter l'offre). */
export async function describeImage(bytes: Buffer, mimeType: string, lang: "fr" | "en"): Promise<string | null> {
  const c = cfg();
  if (!c) return null;
  if (bytes.length > 6 * 1024 * 1024) return null;
  try {
    const res = await fetch(`${c.url}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: c.chatModel,
        max_tokens: 120,
        temperature: 0,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  lang === "fr"
                    ? "Un prospect d'une agence de marketing digital envoie cette image. Décris en 1 à 2 phrases ce qu'elle montre (commerce, produit, logo, site, affiche…) et ce qu'on en déduit de son activité. Pas de Markdown."
                    : "A prospect of a digital marketing agency sends this image. Describe in 1-2 sentences what it shows (shop, product, logo, website, poster…) and what it suggests about their business. No Markdown.",
              },
              { type: "image_url", image_url: { url: `data:${mimeType.split(";")[0]};base64,${bytes.toString("base64")}` } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) throw new Error(`Baarcha vision ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.warn("[baarcha] vision indisponible:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Récupère une pièce jointe : en base64 (OpenWA) ou par URL (Meta, signée et publique). */
export async function loadAttachment(att: { base64?: string | null; url?: string | null; mimeType?: string | null }): Promise<{ bytes: Buffer; mimeType: string } | null> {
  try {
    if (att.base64) return { bytes: Buffer.from(att.base64, "base64"), mimeType: att.mimeType || "application/octet-stream" };
    if (att.url && /^https:\/\//.test(att.url)) {
      const res = await fetch(att.url, { signal: AbortSignal.timeout(20_000) });
      if (!res.ok) return null;
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length > 8 * 1024 * 1024) return null;
      return { bytes, mimeType: att.mimeType || res.headers.get("content-type") || "application/octet-stream" };
    }
  } catch {
    /* pièce jointe illisible : on continue sans */
  }
  return null;
}
