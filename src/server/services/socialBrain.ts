import { prisma } from "@/lib/prisma";
import { formatDT } from "@/lib/format";
import { configuredModel } from "@/buddy/ai/model";
import { compose } from "@/buddy/ai/assist";
import { publicKnowledge, retrieve } from "@/buddy/ai/knowledge";
import { detectLanguage, type Lang } from "@/buddy/core/language";
import { prismaDataSource } from "@/buddy/data/prisma";
import type { LocalModel } from "@/buddy/ai/model";
import { describeImage, loadAttachment, synthesizeSpeech, transcribeAudio } from "@/lib/baarchaMedia";

/**
 * Le « cerveau » commun des réseaux sociaux, de WhatsApp et de l'e-mail.
 *
 * n8n reçoit les messages et les envoie ici ; la réponse est rédigée par le
 * même assistant que le site et l'espace client (mêmes connaissances, même
 * modèle, même garde-fou : rien d'inventé). À chaque message, le cerveau :
 *
 *  1. écarte les doublons (même fil, même texte, moins de 2 minutes) ;
 *  2. retrouve la MÉMOIRE du contact : ses échanges précédents, tous canaux
 *     confondus pour un même identifiant, pour répondre en contexte ;
 *  3. QUALIFIE le message : intention, offre évoquée, score chaud/tiède/froid ;
 *  4. décide d'une PASSATION à l'équipe (réclamation, rendez-vous, demande
 *     explicite d'un humain, question sans réponse sûre) — la réponse le dit
 *     au contact et n8n alerte l'équipe ;
 *  5. ajoute un lien de commande quand le contact veut acheter une offre ;
 *  6. conserve tout comme lead (inbound_leads) pour Admin → Leads.
 */

export const CHANNELS = ["instagram", "facebook", "linkedin", "tiktok", "email", "site", "whatsapp"] as const;
export type Channel = (typeof CHANNELS)[number];

export const INTENTS = ["PRIX", "COMMANDE", "INFO_SERVICE", "RENDEZ_VOUS", "SUPPORT_CLIENT", "RECLAMATION", "PARTENARIAT", "SPAM", "AUTRE"] as const;
export type Intent = (typeof INTENTS)[number];
export const INTENT_LABEL: Record<string, string> = {
  PRIX: "Prix", COMMANDE: "Commande", INFO_SERVICE: "Information", RENDEZ_VOUS: "Rendez-vous",
  SUPPORT_CLIENT: "Support client", RECLAMATION: "Réclamation", PARTENARIAT: "Partenariat", SPAM: "Spam", AUTRE: "Autre",
};
export const LEAD_STATUSES = ["NOUVEAU", "EN_COURS", "CONVERTI", "PERDU"] as const;

export type Attachment = { kind: "audio" | "image"; mimeType?: string | null; base64?: string | null; url?: string | null };

export type BrainInput = {
  channel: Channel;
  message: string;
  /** Note vocale ou photo reçue avec (ou à la place) du texte. */
  attachments?: Attachment[];
  /** WhatsApp : répondre aussi en note vocale (quand le contact a envoyé un vocal). */
  wantVoice?: boolean;
  externalId?: string | null;
  displayName?: string | null;
  contact?: string | null;
  threadRef?: string | null;
  history?: { role: "user" | "assistant"; content: string }[];
  lang?: Lang | null;
};

export type BrainOutput = {
  reply: string;
  lang: Lang;
  ai: boolean;
  suggestions: string[];
  leadId: string;
  /** Doublon : n8n ne renvoie rien. */
  duplicate: boolean;
  intent: Intent;
  score: number;
  /** « chaud » dès 70, « tiède » dès 40. */
  temperature: "chaud" | "tiede" | "froid";
  handoff: boolean;
  handoffReason: string | null;
  packCode: string | null;
  checkoutUrl: string | null;
  summary: string;
  /** Nombre d'échanges déjà eus avec ce contact (0 = premier contact). */
  priorMessages: number;
  /** Transcription du vocal reçu, le cas échéant. */
  transcript: string | null;
  /** Ce que l'IA a vu sur la photo reçue, le cas échéant. */
  imageDescription: string | null;
  /** Réponse en note vocale (opus), si demandée et disponible. */
  voice: { base64: string; mimeType: string } | null;
};

const SITE = (process.env.VITRINE_URL ?? "https://levelupia.agency").replace(/\/+$/, "");
const APP = (process.env.APP_URL ?? "https://levelupia.app").replace(/\/+$/, "").replace(/:\d+$/, "");

const SUGGESTIONS: Record<Lang, string[]> = {
  fr: ["Quels sont vos packs et leurs prix ?", "Comment se déroule un projet ?", "Comment commander ?"],
  en: ["What are your packs and prices?", "How does a project go?", "How do I order?"],
};

/** « Bonjour » jusqu'à 18 h (heure de Tunis), « Bonsoir » ensuite. */
export function salutation(lang: Lang, now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Tunis", hour: "2-digit", hour12: false }).format(now));
  if (lang === "en") return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return hour < 18 ? "Bonjour" : "Bonsoir";
}

const T = {
  fr: {
    welcome: (n: string | null) => `${salutation("fr")}${n ? ` ${n}` : ""} ! Dites-nous comment nous pouvons vous aider.`,
    fallback: (n: string | null) =>
      `${salutation("fr")}${n ? ` ${n}` : ""} ! Merci pour votre message. Je suis l'assistant de Level Up IA : je réponds aux questions sur nos sites web, vidéos IA, automatisations, packs et tarifs. Pour tout le reste, l'équipe vous répond directement à contact@levelupia.agency. Nos offres : ${SITE}/fr`,
    handoff: `Je transmets votre demande à l'équipe Level Up IA, qui vous répond personnellement dans la journée (jours ouvrés). Vous pouvez aussi nous écrire à contact@levelupia.agency.`,
    complaint: `Je suis désolé pour ce désagrément. Votre réclamation est transmise à l'équipe, qui en accuse réception sous 2 jours ouvrés et vous répond sous 7 jours ouvrés : ${SITE}/fr/reclamations`,
    meeting: `Avec plaisir : l'équipe vous propose un créneau par retour de message. Pour aller plus vite, indiquez vos disponibilités et le sujet (site, vidéo, automatisation).`,
    order: (url: string) => `👉 Commander en ligne (carte ou virement) : ${url}`,
    offers: `👉 Toutes nos offres : ${SITE}/fr#packs`,
  },
  en: {
    welcome: (n: string | null) => `${salutation("en")}${n ? ` ${n}` : ""}! Tell us how we can help you.`,
    fallback: (n: string | null) =>
      `${salutation("en")}${n ? ` ${n}` : ""}! Thanks for your message. I'm the Level Up IA assistant: I answer questions about our websites, AI videos, automations, packs and prices. For anything else, the team replies directly at contact@levelupia.agency. Our offers: ${SITE}/en`,
    handoff: `I'm passing your request to the Level Up IA team, who will answer you personally within the day (working days). You can also write to contact@levelupia.agency.`,
    complaint: `I'm sorry about this. Your complaint is forwarded to the team: acknowledgement within 2 working days, answer within 7 working days: ${SITE}/en/reclamations`,
    meeting: `Gladly: the team will propose a slot by return message. To speed things up, share your availability and the topic (website, video, automation).`,
    order: (url: string) => `👉 Order online (card or bank transfer): ${url}`,
    offers: `👉 All our offers: ${SITE}/en#packs`,
  },
} as const;

const GREETING = /^\s*(bonjour|bonsoir|salut|hello|hi|hey|salam|aslema|3aslema|cc|coucou|سلام|عسلامة)[\s!.,]*$/i;
const WANT_HUMAN = /\b(humain|human|quelqu['’]un|someone|conseiller|agent|appel(?:ez|er)?|call me|t[ée]l[ée]phone|nheb nehki|nkallem|parler [àa] (?:un|une|quelqu)|une personne)\b/i;
const COMPLAINT = /\b(r[ée]clamation|plainte|pas content|insatisfait|arnaque|rembours|refund|complain|probl[èe]me avec ma commande|scandale|inacceptable)\b/i;
const MEETING = /\b(rendez[- ]vous|rdv|meeting|r[ée]union|visio|appel d[ée]couverte|disponible pour un|quand peut-on|book a call)\b/i;
const BUY = /\b(commander|acheter|je prends|je veux le pack|on y va|c['’]est parti|go pour|how do i order|i want to order|buy|sign me up|nheb nechri|nekhou|je m['’]inscris|inscription)\b/i;

/** Mots qui trahissent un prospect chaud : budget, délai, décision. */
const HOT = /\b(budget|devis|facture|urgent|rapidement|cette semaine|ce mois|lancement|ouverture|deadline|asap|quand pouvez-vous commencer|combien de temps)\b/i;

function temperature(score: number): BrainOutput["temperature"] {
  return score >= 70 ? "chaud" : score >= 40 ? "tiede" : "froid";
}

function detectPack(text: string, products: { code: string; name: string }[]): string | null {
  const low = text.toLowerCase();
  for (const p of products) {
    const name = p.name.toLowerCase();
    const short = name.replace(/^pack\s+|^abonnement\s+/, "");
    if (low.includes(name) || (short.length >= 4 && low.includes(short))) return p.code;
  }
  return null;
}

/** Qualification par règles — toujours disponible, même sans modèle. */
function ruleIntent(message: string): Intent | null {
  if (COMPLAINT.test(message)) return "RECLAMATION";
  if (MEETING.test(message)) return "RENDEZ_VOUS";
  if (BUY.test(message)) return "COMMANDE";
  if (/\b(prix|tarif|co[uû]te|combien|price|cost|9adech|bech|chhal)\b/i.test(message)) return "PRIX";
  if (/\b(partenariat|collaboration|partnership|sponsor|influenceu|affiliation)\b/i.test(message)) return "PARTENARIAT";
  if (/\b(mon site|ma commande|mon projet|ma facture|mon compte|my order|my project|my invoice|login|mot de passe|password|bug|ne marche pas|erreur)\b/i.test(message)) return "SUPPORT_CLIENT";
  if (/https?:\/\/\S+\.(ru|cn|xyz)\b|\b(crypto|casino|forex|viagra|gagnez \d+|win \$)/i.test(message)) return "SPAM";
  return null;
}

/** Qualification par le modèle (JSON), vérifiée contre la liste fermée. */
async function modelIntent(model: LocalModel, message: string, lang: Lang): Promise<{ intent: Intent | null; summary: string | null }> {
  const system = [
    "You qualify messages sent to Level Up IA, a Tunisian AI-powered digital marketing agency (websites, AI videos, automations, social media packs).",
    "Messages may be in French, English or Tunisian Arabic (Latin or Arabic letters).",
    `Pick ONE intent among: ${INTENTS.join(", ")}.`,
    "PRIX = asks a price/quote. COMMANDE = wants to buy/sign up now. INFO_SERVICE = asks what we do/how it works. RENDEZ_VOUS = wants a call or meeting.",
    "SUPPORT_CLIENT = existing client about their own project/order/account. RECLAMATION = complaint/dissatisfaction. PARTENARIAT = partnership/collaboration offer. SPAM = ads, scams, unrelated. AUTRE = anything else.",
    `Also write a one-line summary (max 100 characters) in ${lang === "fr" ? "French" : "English"} for the sales team.`,
    'Reply only with JSON: {"intent":"<INTENT>","summary":"<text>"}',
  ].join("\n");
  try {
    const raw = await model.chat([{ role: "system", content: system }, { role: "user", content: message }], { json: true, maxTokens: 80, temperature: 0, timeoutMs: 12_000 });
    const parsed = JSON.parse(raw) as { intent?: unknown; summary?: unknown };
    const intent = String(parsed.intent ?? "").toUpperCase().trim();
    return {
      intent: (INTENTS as readonly string[]).includes(intent) ? (intent as Intent) : null,
      summary: typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 200) : null,
    };
  } catch {
    return { intent: null, summary: null };
  }
}

/** Mémoire : les derniers échanges de ce contact, tous canaux confondus pour un même identifiant. */
async function memoryFor(input: BrainInput): Promise<{ history: { role: "user" | "assistant"; content: string }[]; count: number; unknownStreak: number }> {
  if (input.history?.length) return { history: input.history.slice(-8), count: input.history.length, unknownStreak: 0 };
  const key = input.externalId?.trim() || input.contact?.trim();
  if (!key) return { history: [], count: 0, unknownStreak: 0 };
  const rows = await prisma.inboundLead.findMany({
    where: { OR: [{ externalId: key }, { contact: key }] },
    orderBy: { createdAt: "desc" },
    take: 6,
    select: { message: true, reply: true, answeredByAi: true },
  });
  const history: { role: "user" | "assistant"; content: string }[] = [];
  for (const r of rows.reverse()) {
    history.push({ role: "user", content: r.message });
    if (r.reply) history.push({ role: "assistant", content: r.reply });
  }
  // Réponses type consécutives (le modèle ne savait pas) → le contact tourne en rond : passer la main.
  let unknownStreak = 0;
  for (const r of rows) {
    if (r.answeredByAi) break;
    unknownStreak++;
  }
  return { history, count: rows.length, unknownStreak };
}

/**
 * Doublons simultanés : Meta et OpenWA relivrent parfois un événement avant
 * même que la première réponse soit rédigée (le modèle met plusieurs secondes).
 * Une seule réponse est calculée ; les appels concurrents reçoivent la même,
 * marquée doublon, et n'envoient rien.
 */
const inflight = new Map<string, Promise<BrainOutput>>();

export async function answerSocial(input: BrainInput): Promise<BrainOutput> {
  const key = `${input.channel}|${input.externalId ?? input.contact ?? ""}|${input.message.trim().slice(0, 300)}`;
  const pending = inflight.get(key);
  if (pending) return { ...(await pending), duplicate: true };
  const run = answerSocialOnce(input).finally(() => setTimeout(() => inflight.delete(key), 120_000));
  inflight.set(key, run);
  return run;
}

async function answerSocialOnce(input: BrainInput): Promise<BrainOutput> {
  let message = input.message.trim().slice(0, 1500);
  let transcript: string | null = null;
  let imageDescription: string | null = null;
  let mediaKind: "audio" | "image" | null = null;
  const langGuess: Lang = input.lang ?? detectLanguage(message || "bonjour", "fr");

  // 0. pièces jointes : on écoute le vocal, on regarde la photo
  for (const att of (input.attachments ?? []).slice(0, 3)) {
    const loaded = await loadAttachment(att);
    if (!loaded) continue;
    if (att.kind === "audio") {
      mediaKind = "audio";
      transcript = await transcribeAudio(loaded.bytes, loaded.mimeType);
      if (transcript) message = [message, transcript].filter(Boolean).join("\n").slice(0, 1500);
    } else if (att.kind === "image") {
      mediaKind = mediaKind ?? "image";
      imageDescription = await describeImage(loaded.bytes, loaded.mimeType, langGuess);
    }
  }
  if (!message && mediaKind === "audio" && !transcript) {
    // Vocal reçu mais impossible à écouter : on le dit franchement et on passe la main.
    const lang: Lang = langGuess;
    const reply = lang === "fr"
      ? "J'ai bien reçu votre note vocale mais je n'ai pas pu l'écouter. Pouvez-vous m'écrire votre demande en quelques mots ? L'équipe Level Up IA est aussi joignable à contact@levelupia.agency."
      : "I received your voice note but couldn't listen to it. Could you write your request in a few words? The Level Up IA team is also reachable at contact@levelupia.agency.";
    const lead = await prisma.inboundLead.create({ data: { channel: input.channel, externalId: input.externalId?.slice(0, 160) || null, displayName: input.displayName?.slice(0, 160) || null, contact: input.contact?.slice(0, 254) || null, message: "[vocal non transcrit]", reply, answeredByAi: false, lang, threadRef: input.threadRef?.slice(0, 160) || null, intent: "AUTRE", score: 20, summary: "Note vocale non transcrite", mediaKind: "audio" }, select: { id: true } });
    return { reply, lang, ai: false, suggestions: SUGGESTIONS[lang], leadId: lead.id.toString(), duplicate: false, intent: "AUTRE", score: 20, temperature: "froid", handoff: false, handoffReason: null, packCode: null, checkoutUrl: null, summary: "Note vocale non transcrite", priorMessages: 0, transcript: null, imageDescription: null, voice: null };
  }
  if (!message && imageDescription) message = langGuess === "fr" ? "(photo envoyée sans texte)" : "(photo sent without text)";
  if (!message) message = langGuess === "fr" ? "(message vide)" : "(empty message)";
  const lang: Lang = input.lang ?? detectLanguage(message, "fr");
  const t = T[lang];
  const name = input.displayName?.trim().split(/\s+/)[0] || null;

  // 1. doublon (webhooks Meta/WAHA relivrent parfois le même événement)
  const dup = await prisma.inboundLead.findFirst({
    where: {
      message,
      channel: input.channel,
      ...(input.externalId ? { externalId: input.externalId } : {}),
      createdAt: { gt: new Date(Date.now() - 2 * 60_000) },
    },
    select: { id: true, reply: true, intent: true, score: true, handoff: true, packCode: true, summary: true, answeredByAi: true },
  });
  if (dup) {
    return {
      reply: dup.reply ?? "", lang, ai: dup.answeredByAi, suggestions: SUGGESTIONS[lang], leadId: dup.id.toString(), duplicate: true,
      intent: (dup.intent as Intent) ?? "AUTRE", score: dup.score, temperature: temperature(dup.score), handoff: dup.handoff, handoffReason: null,
      packCode: dup.packCode, checkoutUrl: dup.packCode ? `${APP}/paiement/choisir?pack=${dup.packCode}` : null, summary: dup.summary ?? "", priorMessages: 0,
      transcript: null, imageDescription: null, voice: null,
    };
  }

  const model = configuredModel();
  const products = await prismaDataSource.products();
  const memory = await memoryFor(input);

  // 2. qualification
  let intent: Intent | null = ruleIntent(message);
  let summary: string | null = null;
  if (model && !GREETING.test(message)) {
    const q = await modelIntent(model, message, lang);
    intent = intent ?? q.intent;
    summary = q.summary;
  }
  intent = intent ?? (GREETING.test(message) ? "AUTRE" : "INFO_SERVICE");
  const packCode = detectPack(message, products) ?? detectPack(memory.history.map((h) => h.content).join(" "), products);

  let score = { COMMANDE: 85, PRIX: 65, RENDEZ_VOUS: 70, INFO_SERVICE: 40, SUPPORT_CLIENT: 30, PARTENARIAT: 35, RECLAMATION: 20, SPAM: 0, AUTRE: 15 }[intent];
  if (packCode) score += 10;
  if (HOT.test(message)) score += 10;
  if (memory.count >= 2) score += 5;
  if (input.contact) score += 5;
  score = Math.max(0, Math.min(100, score));

  // 3. passation à l'équipe ?
  let handoffReason: string | null = null;
  if (intent === "RECLAMATION") handoffReason = "réclamation";
  else if (intent === "RENDEZ_VOUS") handoffReason = "demande de rendez-vous";
  else if (WANT_HUMAN.test(message)) handoffReason = "demande explicite d'un humain";
  else if (intent === "SUPPORT_CLIENT") handoffReason = "client existant : question sur son dossier";
  else if (intent === "PARTENARIAT") handoffReason = "proposition de partenariat";
  else if (memory.unknownStreak >= 2) handoffReason = "l'assistant n'a pas su répondre deux fois de suite";

  // 4. réponse
  let reply: string | null = null;
  let ai = false;
  if (intent === "SPAM") {
    reply = t.fallback(name);
  } else if (GREETING.test(message)) {
    reply = t.welcome(name);
  } else if (intent === "RECLAMATION") {
    reply = t.complaint;
  } else if (intent === "RENDEZ_VOUS") {
    reply = t.meeting;
  } else if (model) {
    const pool = publicKnowledge(products, lang, formatDT);
    const found = await retrieve(message, pool, 3, model);
    const about = pool.filter((c) => c.id === `site:${lang}:about` && !found.includes(c));
    const context = memory.history
      .slice(-6)
      .map((h) => `${h.role === "user" ? (lang === "fr" ? "Contact" : "Contact") : "Level Up IA"} : ${h.content.slice(0, 300)}`)
      .join("\n");
    // La photo comprise devient une connaissance : le garde-fou l'accepte comme source
    // (sinon toute réponse qui la mentionne serait rejetée comme « inventée »).
    const photo = imageDescription
      ? [{ id: "photo", lang, title: lang === "fr" ? "Photo envoyée par le contact" : "Photo sent by the contact", text: imageDescription }]
      : [];
    const composed = await compose(model, {
      lang,
      message: `${context ? `${lang === "fr" ? "Échanges précédents" : "Previous messages"} :\n${context}\n\n${lang === "fr" ? "Nouveau message" : "New message"} : ` : ""}${message}`,
      knowledge: [...photo, ...found, ...about],
    });
    if (composed) {
      reply = composed.text;
      ai = true;
    }
  }
  if (!reply) {
    reply = handoffReason ? t.handoff : t.fallback(name);
  } else if (memory.count === 0 && ai && !/^(bonjour|bonsoir|salut|hello|hi|good (morning|afternoon|evening))\b/i.test(reply)) {
    // Premier contact : un seul mot d'accueil, adapté à l'heure, devant la réponse.
    reply = `${salutation(lang)}${name ? ` ${name}` : ""} ! ${reply}`;
  }
  if (reply && handoffReason && intent !== "RECLAMATION" && intent !== "RENDEZ_VOUS" && !reply.includes(t.handoff)) {
    reply = `${reply}\n\n${t.handoff}`;
  }

  // 5. lien de commande
  const checkoutUrl = packCode ? `${APP}/paiement/choisir?pack=${packCode}` : null;
  if (intent === "COMMANDE" || (intent === "PRIX" && packCode)) {
    reply = `${reply}\n\n${checkoutUrl ? t.order(checkoutUrl) : t.offers}`;
  }

  if (!summary) summary = `${INTENT_LABEL[intent]} — ${message.replace(/\s+/g, " ").slice(0, 90)}`;

  // 6. lead
  const lead = await prisma.inboundLead.create({
    data: {
      channel: input.channel,
      externalId: input.externalId?.slice(0, 160) || null,
      displayName: input.displayName?.slice(0, 160) || null,
      contact: input.contact?.slice(0, 254) || null,
      message: [transcript ? `🎤 ${transcript}` : null, imageDescription ? `🖼 ${imageDescription}` : null, transcript ? null : message].filter(Boolean).join("\n").slice(0, 4000) || message,
      reply,
      answeredByAi: ai,
      lang,
      threadRef: input.threadRef?.slice(0, 160) || null,
      mediaKind,
      intent,
      score,
      handoff: handoffReason !== null,
      packCode,
      summary: summary.slice(0, 200),
      status: intent === "SPAM" ? "PERDU" : "NOUVEAU",
    },
    select: { id: true },
  });

  // 7. réponse vocale (WhatsApp) : seulement quand le contact a lui-même parlé
  const voice = input.wantVoice && intent !== "SPAM" ? await synthesizeSpeech(reply) : null;

  return {
    reply, lang, ai, suggestions: SUGGESTIONS[lang], leadId: lead.id.toString(), duplicate: false,
    intent, score, temperature: temperature(score), handoff: handoffReason !== null, handoffReason, packCode, checkoutUrl, summary, priorMessages: memory.count,
    transcript, imageDescription, voice,
  };
}

/* ------------------------------------------------------------ relances */

const FOLLOWUP_AFTER_H = 48;
const FOLLOWUP_BEFORE_D = 7;

/**
 * Prospects chauds (score ≥ 70) restés sans suite depuis 48 h, jamais relancés,
 * joignables par WhatsApp ou e-mail. Une relance par contact, puis plus rien :
 * l'insistance fait fuir.
 */
export async function dueFollowups() {
  const now = Date.now();
  const rows = await prisma.inboundLead.findMany({
    where: {
      channel: { in: ["whatsapp", "email"] },
      status: { in: ["NOUVEAU", "EN_COURS"] },
      createdAt: { gt: new Date(now - FOLLOWUP_BEFORE_D * 86_400_000) },
    },
    orderBy: { createdAt: "desc" },
  });
  const byContact = new Map<string, typeof rows>();
  for (const r of rows) {
    const k = `${r.channel}:${r.externalId ?? r.contact ?? r.id}`;
    byContact.set(k, [...(byContact.get(k) ?? []), r]);
  }
  const due: { leadId: string; channel: string; externalId: string | null; contact: string | null; displayName: string | null; lang: string; packCode: string | null; checkoutUrl: string | null; message: string }[] = [];
  for (const [, list] of byContact) {
    const latest = list[0]!;
    const score = Math.max(...list.map((r) => r.score));
    if (score < 70) continue;
    if (list.some((r) => r.followedUpAt)) continue;
    if (now - latest.createdAt.getTime() < FOLLOWUP_AFTER_H * 3600_000) continue;
    const lang = (latest.lang === "en" ? "en" : "fr") as Lang;
    const pack = list.find((r) => r.packCode)?.packCode ?? null;
    const name = latest.displayName?.split(/\s+/)[0] || null;
    const url = pack ? `${APP}/paiement/choisir?pack=${pack}` : `${SITE}/${lang}#packs`;
    const message = lang === "fr"
      ? `Bonjour${name ? ` ${name}` : ""}, c'est l'équipe Level Up IA. Vous nous aviez contactés${pack ? ` au sujet du ${pack.replace(/_/g, " ").toLowerCase()}` : ""} : avez-vous encore des questions ? Nous sommes là pour vous aider à démarrer. ${pack ? "Commander en ligne : " : "Nos offres : "}${url}`
      : `Hello${name ? ` ${name}` : ""}, this is the Level Up IA team. You contacted us${pack ? ` about ${pack.replace(/_/g, " ").toLowerCase()}` : ""}: any remaining questions? We're here to help you get started. ${pack ? "Order online: " : "Our offers: "}${url}`;
    due.push({ leadId: latest.id.toString(), channel: latest.channel, externalId: latest.externalId, contact: latest.contact, displayName: latest.displayName, lang, packCode: pack, checkoutUrl: pack ? url : null, message });
  }
  return due;
}

/** n8n a envoyé la relance : on la date sur tous les messages du contact. */
export async function markFollowedUp(leadId: bigint) {
  const lead = await prisma.inboundLead.findUniqueOrThrow({ where: { id: leadId }, select: { externalId: true, contact: true } });
  const key = lead.externalId ?? lead.contact;
  await prisma.inboundLead.updateMany({
    where: key ? { OR: [{ externalId: key }, { contact: key }] } : { id: leadId },
    data: { followedUpAt: new Date(), status: "EN_COURS" },
  });
  return true;
}

/* ------------------------------------------------------------ administration */

export type LeadRow = {
  id: string; channel: string; externalId: string | null; displayName: string | null; contact: string | null;
  message: string; reply: string | null; answeredByAi: boolean; lang: string | null; threadRef: string | null;
  intent: string | null; score: number; handoff: boolean; status: string; packCode: string | null; summary: string | null; createdAt: string;
};

const toRow = (r: Awaited<ReturnType<typeof prisma.inboundLead.findMany>>[number]): LeadRow => ({
  id: r.id.toString(), channel: r.channel, externalId: r.externalId, displayName: r.displayName, contact: r.contact,
  message: r.message, reply: r.reply, answeredByAi: r.answeredByAi, lang: r.lang, threadRef: r.threadRef,
  intent: r.intent, score: r.score, handoff: r.handoff, status: r.status, packCode: r.packCode, summary: r.summary, createdAt: r.createdAt.toISOString(),
});

/** Leads pour l'administration, les plus récents d'abord. */
export async function listLeads(limit = 300): Promise<LeadRow[]> {
  const rows = await prisma.inboundLead.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  return rows.map(toRow);
}

export async function updateLeadStatus(leadId: bigint, status: string) {
  if (!(LEAD_STATUSES as readonly string[]).includes(status)) throw new Error("Statut inconnu.");
  // Le statut vaut pour le contact entier : tous ses messages suivent.
  const lead = await prisma.inboundLead.findUniqueOrThrow({ where: { id: leadId }, select: { externalId: true, contact: true, channel: true } });
  const key = lead.externalId ?? lead.contact;
  await prisma.inboundLead.updateMany({
    where: key ? { OR: [{ externalId: key }, { contact: key }] } : { id: leadId },
    data: { status, ...(status !== "NOUVEAU" ? { handoff: false } : {}) },
  });
  return true;
}

/** Bilan du jour pour l'équipe (envoyé par n8n chaque soir). */
export async function dailyDigest() {
  const since = new Date(Date.now() - 24 * 3600_000);
  const rows = await prisma.inboundLead.findMany({ where: { createdAt: { gt: since } }, orderBy: { score: "desc" } });
  const byChannel: Record<string, number> = {};
  for (const r of rows) byChannel[r.channel] = (byChannel[r.channel] ?? 0) + 1;
  const contacts = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    const k = `${r.channel}:${r.externalId ?? r.contact ?? r.displayName ?? r.id}`;
    if (!contacts.has(k)) contacts.set(k, r);
  }
  const hot = [...contacts.values()].filter((r) => r.score >= 70).map((r) => ({
    name: r.displayName ?? r.contact ?? r.externalId ?? "?", channel: r.channel, intent: r.intent, score: r.score, summary: r.summary, packCode: r.packCode,
  }));
  const handoffs = rows.filter((r) => r.handoff && r.status === "NOUVEAU").map((r) => ({
    name: r.displayName ?? r.contact ?? r.externalId ?? "?", channel: r.channel, intent: r.intent, summary: r.summary, at: r.createdAt.toISOString(),
  }));
  const pendingTotal = await prisma.inboundLead.count({ where: { handoff: true, status: "NOUVEAU" } });
  return {
    date: new Date().toISOString().slice(0, 10),
    messages: rows.length,
    contacts: contacts.size,
    byChannel,
    answeredByAi: rows.filter((r) => r.answeredByAi).length,
    hot,
    handoffs,
    pendingHandoffs: pendingTotal,
    leadsUrl: `${APP}/admin/leads`,
  };
}
