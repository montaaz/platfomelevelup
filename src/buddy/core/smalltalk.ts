import { tokenize, isStopword } from "./normalize";

/**
 * Salutations, remerciements, au revoir.
 *
 * Un « bonjour » refusé comme question inconnue passe pour de la bêtise. Ces
 * quelques mots reçoivent une réponse fixe — et seulement quand le message
 * ne contient rien d'autre : « bonjour, mes factures » est une vraie
 * question et suit le chemin normal. Le parler tunisien est compris aussi.
 */

export type SmallTalk = "greeting" | "thanks" | "bye";

const GREETINGS = new Set([
  "bonjour", "bonsoir", "salut", "coucou", "hello", "hi", "hey", "yo",
  "salam", "aslema", "3aslema", "sbah", "sabah", "kheir", "khir", "marhba", "marhaba",
]);
const THANKS = new Set([
  "merci", "thanks", "thank", "thx", "chokran", "choukran", "yaichek", "3aychek",
  "ya3tik", "sa7a", "saha", "barakallahoufik",
]);
const BYE = new Set([
  "bye", "goodbye", "ciao", "adieu", "bslema", "beslema", "besslema", "revoir", "bientot",
]);

export function detectSmallTalk(message: string): SmallTalk | null {
  const tokens = tokenize(message);
  if (tokens.length === 0 || tokens.length > 5) return null;

  let kind: SmallTalk | null = null;
  for (const t of tokens) {
    if (BYE.has(t)) kind = "bye";
    else if (THANKS.has(t)) kind = kind ?? "thanks";
    else if (GREETINGS.has(t)) kind = kind ?? "greeting";
    else if (!isStopword(t) && !/^(ca|va|vous|toi|tout|bien|beaucoup|much|very|a|plus|tard|good|morning|evening|afternoon|there|you|all)$/.test(t)) {
      return null; // un mot qui n'est ni politesse ni mot vide : c'est une question
    }
  }
  return kind;
}
