import { route, scoreIntent, type IntentDef, type RouteResult } from "./core/router";
import { tokenize } from "./core/normalize";
import { extractFilters, type Filters } from "./filters";
import { extractEntity, type EntityRef } from "./entity";
import { detectLanguage, type Lang } from "./core/language";
import { detectSmallTalk, type SmallTalk } from "./core/smalltalk";

/**
 * Interface de compréhension du message.
 *
 * Tout ce que l'assistant « comprend » d'un message passe par ici : langue,
 * politesse, intention, entité visée, filtres. Aujourd'hui l'implémentation
 * est un routeur par règles — déterministe, testable, sans réseau. C'est
 * l'unique endroit à remplacer pour brancher un modèle local.
 *
 * Brancher un modèle local (Ollama, par exemple) demanderait :
 *   1. une implémentation de `Understander` qui envoie le message à
 *      http://127.0.0.1:11434/api/chat avec un prompt de classification
 *      contraint : renvoyer un JSON { intent, projectRef, status, period }
 *      parmi les valeurs autorisées — jamais de texte libre ;
 *   2. la validation stricte de ce JSON (mêmes règles que `parseContext`),
 *      et le repli sur le routeur par règles si le modèle ne répond pas ou
 *      répond hors liste ;
 *   3. de laisser la réponse elle-même aux gabarits : le modèle classe, il
 *      ne rédige pas, donc il ne peut pas inventer une facture ou une date ;
 *   4. sur le serveur, un modèle de petite taille (3 à 8 milliards de
 *      paramètres, quantifié) et 4 à 8 Go de RAM dédiés, avec une latence de
 *      une à trois secondes par message sur processeur.
 * Ce qui ne changerait pas : la session, le cloisonnement par client, les
 * requêtes fixes, les gabarits, l'historique.
 */

export type Understanding = {
  lang: Lang;
  smallTalk: SmallTalk | null;
  routed: RouteResult<string>;
  entity: EntityRef;
  filters: Filters;
  /** Scores partiels, pour proposer des pistes quand rien n'est retenu. */
  partial: { id: string; score: number }[];
};

export interface Understander {
  understand(message: string, opts: { intents: IntentDef<string>[]; previousLang?: Lang; now: Date }): Understanding;
}

/** Implémentation par règles : la seule disponible aujourd'hui. */
export const ruleBasedUnderstander: Understander = {
  understand(message, { intents, previousLang, now }) {
    const lang = detectLanguage(message, previousLang ?? "fr");
    return {
      lang,
      smallTalk: detectSmallTalk(message),
      routed: route(message, intents),
      entity: extractEntity(message),
      filters: extractFilters(message, now),
      partial: partialScores(message, intents),
    };
  },
};

/** Intentions effleurées par le message, meilleures d'abord — même sous le seuil. */
function partialScores(message: string, intents: IntentDef<string>[]): { id: string; score: number }[] {
  const tokens = tokenize(message);
  return intents
    .map((def) => ({ id: def.id, score: scoreIntent(tokens, def) }))
    .filter((x) => x.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
