import { normalize, tokenize } from "./core/normalize";

/**
 * Filtres exprimés dans la question elle-même.
 *
 * « mes factures payées ce mois », « la facture F-2026-041 », « où en est le
 * projet Vidéo IA », « les 3 dernières commandes », « détaille la 2ᵉ » : chaque
 * précision devient un paramètre validé — un statut parmi une liste fermée,
 * une date calculée, une référence au format connu, un nom borné. Les
 * requêtes restent fixes ; seuls leurs paramètres changent.
 */

export type StatusToken =
  | "PAYEE" | "EN_ATTENTE" | "EN_RETARD" | "ANNULEE"
  | "EN_COURS" | "EN_REVISION" | "LIVRE" | "CLOTURE";

export const STATUS_TOKENS: StatusToken[] = [
  "PAYEE", "EN_ATTENTE", "EN_RETARD", "ANNULEE", "EN_COURS", "EN_REVISION", "LIVRE", "CLOTURE",
];

export type Filters = {
  status?: StatusToken;
  since?: Date;
  until?: Date;
  /** Libellé humain de la période, pour l'en-tête de la réponse. */
  label?: string;
  /** Numéro de facture, normalisé en F-AAAA-NNN. */
  reference?: string;
  /** Nom (ou début de nom) de projet. */
  name?: string;
  /** Position dans la liste précédente, 1 = premier, -1 = dernier. */
  ordinal?: number;
  limit?: number;
  /** Le message commence par « et », « aussi »… : il prolonge la question précédente. */
  connector: boolean;
};

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const shift = (s.getDay() + 6) % 7; // lundi = 0
  return new Date(s.getTime() - shift * DAY);
}

const ORDINAL_WORDS: Record<string, number> = {
  premier: 1, premiere: 1, first: 1,
  deuxieme: 2, second: 2, seconde: 2,
  troisieme: 3, third: 3,
  quatrieme: 4, fourth: 4,
  cinquieme: 5, fifth: 5,
  dernier: -1, derniere: -1, last: -1,
};

export function extractFilters(raw: string, now: Date): Filters {
  const n = normalize(raw);
  const tokens = tokenize(raw);
  const has = (re: RegExp) => re.test(n);
  const f: Filters = { connector: /^(et|and|aussi|also|pareil|idem|same|meme chose)\b/.test(n) };

  /* --- statut : la liste est fermée, rien d'autre ne passe --- */
  if (has(/\b(impaye|impayes|impayee|impayees|unpaid|a payer|a regler|to pay|non payee|non payees)\b/)) f.status = "EN_ATTENTE";
  else if (has(/\b(en retard|retard|overdue|late|echue|echues)\b/)) f.status = "EN_RETARD";
  else if (has(/\b(annulee|annulees|annule|annules|cancelled|canceled)\b/)) f.status = "ANNULEE";
  else if (has(/\b(payee|payees|paye|payes|paid|reglee|reglees|regle|regles|encaissee|encaissees)\b/)) f.status = "PAYEE";
  else if (has(/\b(en cours|in progress|ongoing|actif|actifs|active)\b/)) f.status = "EN_COURS";
  else if (has(/\b(en revision|revision|under review|a valider)\b/)) f.status = "EN_REVISION";
  else if (has(/\b(livre|livres|livree|livrees|delivered)\b/)) f.status = "LIVRE";
  else if (has(/\b(cloture|clotures|cloturee|cloturees|closed|termine|termines|terminee|terminees|finished)\b/)) f.status = "CLOTURE";
  else if (has(/\b(en attente|pending|attente|awaiting)\b/)) f.status = "EN_ATTENTE";

  /* --- période --- */
  const days = /\b(?:depuis|derniers|dernieres|last|past)\s+(\d{1,3})\s*(?:jours|days|j)\b|\b(\d{1,3})\s+(?:derniers|dernieres|last)\s+(?:jours|days)\b/.exec(n);
  if (days) {
    const count = Number(days[1] ?? days[2]);
    if (count > 0 && count <= 365) { f.since = new Date(startOfDay(now).getTime() - count * DAY); f.label = `des ${count} derniers jours`; }
  } else if (has(/\baujourd hui\b|\btoday\b/)) { f.since = startOfDay(now); f.label = "d'aujourd'hui"; }
  else if (has(/\bhier\b|\byesterday\b/)) { f.since = new Date(startOfDay(now).getTime() - DAY); f.until = startOfDay(now); f.label = "d'hier"; }
  else if (has(/\bcette semaine\b|\bthis week\b/)) { f.since = startOfWeek(now); f.label = "de cette semaine"; }
  else if (has(/\bsemaine derniere\b|\bla semaine passee\b|\blast week\b/)) { f.since = new Date(startOfWeek(now).getTime() - 7 * DAY); f.until = startOfWeek(now); f.label = "de la semaine dernière"; }
  else if (has(/\bce mois\b|\bdu mois\b|\bthis month\b/)) { f.since = startOfMonth(now); f.label = "de ce mois"; }
  else if (has(/\bmois dernier\b|\ble mois passe\b|\blast month\b/)) {
    f.since = new Date(now.getFullYear(), now.getMonth() - 1, 1); f.until = startOfMonth(now); f.label = "du mois dernier";
  } else if (has(/\bcette annee\b|\bthis year\b/)) { f.since = new Date(now.getFullYear(), 0, 1); f.label = "de cette année"; }

  /* --- nombre d'éléments : « les 3 dernières », « last 5 » --- */
  const limit = /\b(\d{1,2})\s+(?:derniers|dernieres|last|premiers|premieres|first)\b|\b(?:derniers|dernieres|last|premiers|premieres|first)\s+(\d{1,2})\b/.exec(n);
  if (limit && !days) {
    const count = Number(limit[1] ?? limit[2]);
    if (count > 0 && count <= 50) f.limit = count;
  }

  /* --- position : « la 2e », « le deuxième », « la dernière » --- */
  // « 1er », « 1re », « 2e », « 3ème », « 4th »
  const ordinalDigit = /\b(\d{1,2})\s*(?:e|er|ere|re|eme|ieme|nd|rd|th|st)\b/.exec(n);
  if (ordinalDigit) f.ordinal = Number(ordinalDigit[1]);
  else if (!f.limit) {
    const word = tokens.find((t) => t in ORDINAL_WORDS);
    if (word) f.ordinal = ORDINAL_WORDS[word];
  }

  /* --- référence de facture : F-2026-041, f 2026 041 --- */
  const ref = /\bf\s?(\d{4})\s?(\d{3,4})\b/.exec(n);
  if (ref) f.reference = `F-${ref[1]}-${ref[2]}`;

  /* --- nom de projet, sur le texte brut pour garder la casse --- */
  const name = /\b(?:projet|project)\s+(?:«\s*|"\s*)?([^«»"?!.\n]{2,60})/i.exec(raw);
  if (name) {
    const candidate = name[1]!.replace(/\s+(en cours|en revision|en révision|livré|livre|clôturé|cloture|actif|actifs|de ce mois|ce mois|cette semaine|payé|paye)\b.*$/i, "").trim();
    const generic = /^(s|en|de|du|des|actifs?|cours|revision|révision|termin)/i.test(candidate) || candidate.length < 2;
    if (!generic) f.name = candidate.slice(0, 60);
  }

  return f;
}
