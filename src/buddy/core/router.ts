import { tokenize, termMatches } from "./normalize";

/**
 * Routeur d'intentions sans modèle.
 *
 * Chaque intention approuvée déclare les termes qui la désignent. Le routeur
 * compte ce que le message contient, retient la meilleure intention si elle
 * dépasse un seuil, et signale l'ambiguïté quand deux intentions arrivent
 * trop proches. Il ne génère rien — ni texte, ni requête — et un message qui
 * ne ressemble à aucune intention est simplement refusé.
 */

export type IntentDef<Id extends string = string> = {
  id: Id;
  /** Termes forts : un mot du message qui en touche un vaut 2 points. */
  strong?: string[];
  /** Termes faibles : un mot du message qui en touche un vaut 1 point. */
  keywords?: string[];
  /** Expressions : tous les mots présents valent 3 points. « en attente de paiement ». */
  phrases?: string[];
  /** Termes qui écartent l'intention s'ils apparaissent. */
  exclude?: string[];
  /** Seuil propre à l'intention ; sinon celui du routeur. */
  minScore?: number;
};

export type RouteResult<Id extends string = string> =
  | { kind: "match"; id: Id; score: number }
  | { kind: "ambiguous"; ids: Id[] }
  | { kind: "none" };

export type RouteOptions = {
  /** Score minimal pour retenir une intention (défaut : 2). */
  threshold?: number;
  /** Écart en dessous duquel deux intentions sont jugées indiscernables (défaut : 1). */
  gap?: number;
};

const hasTerm = (tokens: string[], term: string) => tokens.some((t) => termMatches(t, term));

/**
 * Score d'une intention pour un message déjà découpé en mots.
 *
 * On compte les mots du message qui touchent la liste, et non les termes de
 * la liste touchés : « factures » ne doit valoir qu'une fois, même si la
 * liste contient aussi « facture » et « facturation ».
 */
export function scoreIntent(tokens: string[], def: IntentDef): number {
  if (def.exclude?.some((term) => hasTerm(tokens, term))) return 0;

  const distinct = [...new Set(tokens)];
  let score = 0;
  for (const token of distinct) {
    if (def.strong?.some((term) => termMatches(token, term))) score += 2;
    else if (def.keywords?.some((term) => termMatches(token, term))) score += 1;
  }
  for (const phrase of def.phrases ?? []) {
    if (hasPhrase(tokens, tokenize(phrase))) score += 3;
  }
  return score;
}

/**
 * Une expression est présente si ses mots se suivent dans le message, dans
 * l'ordre. Sans cette contrainte, « what do you do » validerait n'importe
 * quelle phrase contenant ces trois mots épars.
 */
function hasPhrase(tokens: string[], words: string[]): boolean {
  if (words.length === 0 || words.length > tokens.length) return false;
  for (let start = 0; start + words.length <= tokens.length; start++) {
    if (words.every((w, j) => termMatches(tokens[start + j]!, w))) return true;
  }
  return false;
}

/**
 * Choisit l'intention d'un message, ou refuse.
 *
 * Deux refus distincts : `none` quand rien n'atteint le seuil, `ambiguous`
 * quand la deuxième intention talonne la première — on préfère alors
 * demander plutôt que deviner.
 */
export function route<Id extends string>(
  message: string,
  intents: IntentDef<Id>[],
  opts: RouteOptions = {},
): RouteResult<Id> {
  const threshold = opts.threshold ?? 2;
  const gap = opts.gap ?? 1;
  const tokens = tokenize(message);
  if (tokens.length === 0) return { kind: "none" };

  const ranked = intents
    .map((def) => ({ def, score: scoreIntent(tokens, def) }))
    .filter(({ def, score }) => score >= (def.minScore ?? threshold))
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) return { kind: "none" };

  const [top, second] = ranked;
  if (second && top.score - second.score < gap) {
    return { kind: "ambiguous", ids: [top.def.id, second.def.id] };
  }
  return { kind: "match", id: top.def.id, score: top.score };
}
