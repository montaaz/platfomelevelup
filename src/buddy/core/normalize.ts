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
  "bien", "aussi", "comme", "mais", "donc", "car", "si", "y", "se", "me", "te", "lui",
  "quel", "quelle", "quels", "quelles", "etre", "avoir", "ai", "as", "avez", "avons",
  "ont", "fait", "faire", "peut", "peux", "pouvez", "vraiment", "encore", "deja", "toujours",
  "svp", "merci", "bonjour", "salut",
  // anglais
  "the", "an", "and", "or", "of", "to", "in", "on", "at", "for", "with", "without",
  "is", "are", "was", "were", "be", "been", "do", "does", "did", "can", "could", "would",
  "should", "will", "i", "you", "he", "she", "it", "we", "they", "my", "your", "our", "their",
  "us", "them", "this", "that", "these", "those", "what", "which", "who", "whom",
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

export function isStopword(token: string): boolean {
  return STOPWORDS.has(token);
}

/**
 * Distance d'édition entre deux mots (Damerau-Levenshtein : une lettre en
 * trop, en moins, changée, ou deux lettres inversées comptent chacune 1),
 * bornée : au-delà de `max`, on renvoie `max + 1` sans finir le calcul.
 */
export function editDistance(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    rows[i] = [i];
    for (let j = 1; j <= b.length; j++) {
      if (i === 0) { rows[0]![j] = j; continue; }
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(rows[i - 1]![j]! + 1, rows[i]![j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        best = Math.min(best, rows[i - 2]![j - 2]! + 1);
      }
      rows[i]![j] = best;
    }
    if (i > 0 && Math.min(...rows[i]!) > max) return max + 1;
  }
  return rows[a.length]![b.length]!;
}

/**
 * Un mot du message correspond-il à un terme attendu ?
 *
 * Trois façons de se rejoindre, de la plus stricte à la plus tolérante :
 * égalité ; même racine sur les premières lettres (pluriels et dérivés :
 * « facture », « factures », « facturation ») ; enfin une faute de frappe,
 * une lettre à partir de cinq, deux à partir de neuf (« factuers »,
 * « comande »). Jamais en dessous de quatre lettres : « pro » attraperait
 * « projet », « aide » deviendrait « aime ».
 */
export function termMatches(token: string, term: string): boolean {
  if (token === term) return true;
  if (token.length < 4 || term.length < 4) return false;
  const shortest = Math.min(token.length, term.length);
  const stem = shortest >= 5 ? 5 : 4;
  if (token.slice(0, stem) === term.slice(0, stem)) return true;
  const allowed = shortest >= 9 ? 2 : shortest >= 5 ? 1 : 0;
  return allowed > 0 && editDistance(token, term, allowed) <= allowed;
}
