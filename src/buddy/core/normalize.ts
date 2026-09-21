/**
 * Normalisation du texte pour la reconnaissance d'intention.
 *
 * Tout passe par ici avant comparaison : accents retirés, casse abaissée,
 * ponctuation neutralisée. « Où en sont mes Factures ? » et « ou en sont mes
 * factures » sont ainsi le même message. Aucun modèle, aucune ambiguïté :
 * la fonction est pure et déterministe.
 */

/** Mots vides FR + EN, ignorés lors du rapprochement avec les questions de la FAQ. */
const STOPWORDS = new Set([
  // français
  "le", "la", "les", "un", "une", "des", "du", "de", "d", "l", "et", "ou", "a", "au", "aux",
  "en", "est", "sont", "ce", "cet", "cette", "ces", "mon", "ma", "mes", "ton", "ta", "tes",
  "son", "sa", "ses", "vos", "votre", "nos", "notre", "leur", "leurs", "je", "tu", "il",
  "elle", "on", "nous", "vous", "ils", "elles", "que", "qui", "quoi", "dont", "pour", "par",
  "avec", "sans", "sur", "sous", "dans", "chez", "vers", "pas", "ne", "plus", "moins", "tres",
  "bien", "aussi", "comme", "mais", "donc", "car", "si", "y", "se", "me", "te", "lui", "ils",
  "quel", "quelle", "quels", "quelles", "est", "etre", "avoir", "ai", "as", "avez", "avons",
  "ont", "fait", "faire", "peut", "peux", "pouvez", "vraiment", "encore", "deja", "toujours",
  "svp", "merci", "bonjour", "salut",
  // anglais
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "at", "for", "with", "without",
  "is", "are", "was", "were", "be", "been", "do", "does", "did", "can", "could", "would",
  "should", "will", "i", "you", "he", "she", "it", "we", "they", "my", "your", "our", "their",
  "me", "us", "them", "this", "that", "these", "those", "what", "which", "who", "whom",
  "how", "when", "where", "why", "not", "no", "yes", "please", "thanks", "hello", "hi",
  "really", "still", "also", "just", "any", "some", "there", "here",
]);

/** Accents, casse, ponctuation : une seule forme canonique. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Apostrophes et traits d'union séparent : « qu'est-ce », « faites-vous »,
    // « e-commerce » se lisent mot à mot.
    .replace(/[’'`-]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

/** Mots porteurs de sens : sans les mots vides, et d'au moins trois lettres. */
export function contentTokens(text: string): string[] {
  return tokenize(text).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

/**
 * Un mot du message correspond-il à un terme attendu ?
 *
 * Égalité stricte, ou même racine sur les premières lettres pour absorber
 * pluriels et dérivés : « facture », « factures » et « facturation » se
 * rejoignent, comme « commande » et « commander ». La racine est de cinq
 * lettres quand les deux mots le permettent, quatre sinon, et jamais moins :
 * en dessous, « pro » attraperait « projet ».
 */
export function termMatches(token: string, term: string): boolean {
  if (token === term) return true;
  if (token.length < 4 || term.length < 4) return false;
  const stem = Math.min(token.length, term.length) >= 5 ? 5 : 4;
  return token.slice(0, stem) === term.slice(0, stem);
}

export function isStopword(token: string): boolean {
  return STOPWORDS.has(token);
}
