import { detectLanguage, type Lang } from "../core/language";
import { contentTokens, normalize, termMatches } from "../core/normalize";

/**
 * Contrôle d'une réponse rédigée par le modèle local, avant de la montrer.
 *
 * Un petit modèle peut se tromper avec aplomb. On n'affiche donc sa réponse
 * que si elle passe ces vérifications — sinon l'assistant retombe sur ses
 * réponses à règles :
 *  - le modèle a dit qu'il ne savait pas (INCONNU / UNKNOWN) → rien ;
 *  - un chiffre (prix, montant, date, délai, pourcentage) absent des sources
 *    → rejet : c'est le signe le plus sûr d'une invention ;
 *  - une adresse e-mail ou un lien absent des sources → rejet ;
 *  - un nom propre (ville, personne, marque) absent des sources → rejet ;
 *  - réponse dont les mots ne viennent pas des sources (poème, culture
 *    générale, mot inventé) → rejet ;
 *  - « non, nous ne faisons pas X » alors que les sources parlent de X → rejet ;
 *  - mauvaise langue, écriture étrangère, texte vide → rejet ;
 *  - mise en forme Markdown retirée, longueur bornée.
 */

const MAX_ANSWER = 700;

/** « 1 890,50 DT » → ["1890.50"] ; « 15/10/2026 » → ["15", "10", "2026"]. */
export function numbersIn(text: string): Set<string> {
  const joined = text.replace(/(\d)[\s  .,](?=\d{3}(?!\d))/g, "$1");
  const out = new Set<string>();
  for (const m of joined.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const n = m[0].replace(",", ".");
    out.add(n.replace(/\.0+$/, ""));
    // « 890 » et « 890.000 » désignent le même montant.
    if (n.includes(".")) out.add(String(Number(n)));
  }
  return out;
}

/** Noms toujours permis : la marque elle-même. */
const OWN_NAMES = new Set(["level", "up", "ia", "ai", "levelup"]);

/** Mots à majuscule hors début de phrase : « basés à Tunis » → ["Tunis"]. */
export function properNounsIn(text: string): string[] {
  const out: string[] = [];
  for (const sentence of text.split(/(?<=[.!?:…])\s+|\n+/)) {
    const words = sentence.split(/[\s'’«»"“”(),;.!?:…]+/).filter(Boolean);
    for (const w of words.slice(1)) if (/^[A-ZÀ-ÝÆŒ][\p{L}-]+$/u.test(w)) out.push(w);
  }
  return out;
}

const linksIn = (text: string) => new Set((text.match(/(?:https?:\/\/|www\.)\S+|[\w.+-]+@[\w-]+\.[\w.]+/gi) ?? []).map((s) => s.toLowerCase().replace(/[.,;)]+$/, "")));

/** Part minimale des mots de la réponse retrouvés dans les sources. */
const MIN_GROUNDED = 0.25;

/** Mots de la réponse (4 lettres et plus, hors mots-outils) retrouvés dans les sources, de 0 à 1. */
export function groundedness(text: string, sources: string): number {
  const src = [...new Set(contentTokens(sources))];
  const words = contentTokens(text).filter((w) => w.length >= 4);
  if (words.length === 0) return 1;
  const found = words.filter((w) => src.some((s) => s === w || termMatches(w, s) || termMatches(s, w)));
  return found.length / words.length;
}

const NEGATIVE = /^\s*(non|no)\b|\bpas de\b|\bpas d['’]|\bne\s+\S+\s+pas\b|\bn['’]\S+\s+pas\b|\b(do not|don't|does not|doesn't|cannot|can't|not offer)\b/i;
/** Verbes de la question qui ne désignent pas le sujet (« vous faites des logos » → « logos »). */
const QUESTION_VERBS = new Set([
  "faites", "faire", "fait", "pouvez", "peut", "peux", "proposez", "propose", "offrez", "offre", "travaillez", "travailler",
  "avez", "creez", "realisez", "make", "offer", "provide", "work", "have", "does", "create", "level", "levelup",
]);

/** Un refus (« non », « ne … pas ») alors qu'un mot-sujet de la question figure dans les sources. */
export function contradictsSources(text: string, question: string, sources: string): boolean {
  if (!NEGATIVE.test(text)) return false;
  const src = [...new Set(contentTokens(sources))];
  const topics = contentTokens(question).filter((w) => w.length >= 4 && !QUESTION_VERBS.has(w));
  return topics.some((t) => src.some((s) => s === t || termMatches(t, s)));
}

export type GuardResult = { ok: true; text: string } | { ok: false; reason: string };

/** `question` : le message du visiteur, à part des sources pour repérer un refus qui les contredit. */
export function checkAnswer(raw: string, sources: string, lang: Lang, question = ""): GuardResult {
  let text = raw
    .replace(/\*\*|__|`/g, "")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (!text) return { ok: false, reason: "vide" };
  if (/\b(inconnu|unknown)\b/i.test(text)) return { ok: false, reason: "inconnu" };
  if (/[Ѐ-ӿ؀-ۿ぀-ヿ一-鿿가-힯]/.test(text)) return { ok: false, reason: "écriture" };

  // Ce que la question contient (une date, un nom) peut être repris tel quel.
  const all = `${sources}\n${question}`;
  const allowed = numbersIn(all);
  const invented = [...numbersIn(text)].filter((n) => !allowed.has(n));
  if (invented.length) return { ok: false, reason: `chiffres absents des sources : ${invented.join(", ")}` };

  const known = new Set(normalize(all).split(/[^a-z0-9]+/));
  const unknownNames = properNounsIn(text).filter((w) => normalize(w).split(/[^a-z0-9]+/).some((p) => p && !known.has(p) && !OWN_NAMES.has(p)));
  if (unknownNames.length) return { ok: false, reason: `noms absents des sources : ${unknownNames.join(", ")}` };

  const knownLinks = linksIn(all);
  const strangers = [...linksIn(text)].filter((l) => !knownLinks.has(l));
  if (strangers.length) return { ok: false, reason: "lien inconnu" };

  if (detectLanguage(text, lang) !== lang) return { ok: false, reason: "langue" };
  if (groundedness(text, all) < MIN_GROUNDED) return { ok: false, reason: "hors des sources" };
  if (question && contradictsSources(text, question, sources)) return { ok: false, reason: "refus contredit par les sources" };

  if (text.length > MAX_ANSWER) {
    const cut = text.slice(0, MAX_ANSWER);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf(".\n"), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
    text = end > MAX_ANSWER / 2 ? cut.slice(0, end + 1) : `${cut.trimEnd()}…`;
  }
  return { ok: true, text };
}
