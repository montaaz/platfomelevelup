import { tokenize } from "./normalize";

/**
 * Langue d'un message, français ou anglais.
 *
 * On compte les mots-outils propres à chaque langue ; le reste (« message »,
 * « date », « pack ») ne compte pas. À égalité — « ok », « merci pack » —,
 * on garde la langue du tour précédent, le français au départ. Les accents
 * tranchent en faveur du français.
 */

export type Lang = "fr" | "en";

const FR = new Set([
  "le", "la", "les", "des", "du", "un", "une", "est", "sont", "mon", "ma", "mes", "je", "tu", "vous", "nous",
  "pour", "avec", "sur", "dans", "quel", "quelle", "quels", "quelles", "quand", "combien", "comment", "et",
  "ou", "ce", "cette", "ces", "sera", "pret", "prete", "sa", "son", "ses", "facture", "factures", "projet",
  "projets", "fichier", "fichiers", "telecharger", "veux", "voudrais", "parler", "humain", "quelqu", "bonjour",
  "merci", "oui", "avez", "puis", "peux", "dois", "livraison", "livrable", "livrables", "reviser", "revision",
  "approuver", "commande", "commandes", "paye", "payee", "impaye", "impayee", "encore", "aussi", "chez",
  "pas", "ne", "que", "qui", "quoi", "date", "envoye", "equipe",
]);

const EN = new Set([
  "the", "my", "is", "are", "am", "what", "when", "where", "which", "how", "do", "does", "did", "i", "you",
  "we", "with", "for", "and", "of", "to", "can", "could", "want", "need", "talk", "speak", "human", "someone",
  "invoice", "invoices", "project", "projects", "file", "files", "download", "status", "due", "deadline",
  "show", "me", "latest", "last", "about", "its", "it", "hello", "hi", "thanks", "please", "unpaid", "paid",
  "have", "there", "any", "this", "that", "team", "sent", "send", "revision", "approve", "order", "orders",
  "deliverable", "deliverables", "ready", "someone", "help", "not", "yes",
]);

export function detectLanguage(message: string, fallback: Lang = "fr"): Lang {
  const tokens = tokenize(message);
  if (tokens.length === 0) return fallback;
  let fr = /[àâçéèêëîïôûùüÿœ]/i.test(message) ? 1 : 0;
  let en = 0;
  for (const t of tokens) {
    if (FR.has(t)) fr++;
    if (EN.has(t)) en++;
  }
  if (en > fr) return "en";
  if (fr > en) return "fr";
  return fallback;
}

export function isLang(value: unknown): value is Lang {
  return value === "fr" || value === "en";
}
