import { tokenize, isStopword } from "./normalize";

/**
 * Salutations, remerciements, au revoir.
 *
 * Un « bonjour » refusé comme question inconnue passe pour de la bêtise. Ces
 * quelques mots reçoivent une réponse fixe — et seulement quand le message
 * ne contient rien d'autre : « bonjour, mes factures » est une vraie
 * question et suit le chemin normal. Le parler tunisien est compris aussi.
 */

export type SmallTalk = "greeting" | "thanks" | "bye" | "howAreYou" | "whoAreYou" | "help";

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

const HOW_ARE_YOU = /\b(comment (ca|ça|tu|vous|allez|vas)|ca va|ça va|how are you|how s it going|labes|lebes|chnia ahwalek|chnowa ahwalek|3aslema (ahwalek|labes))\b/;
const WHO_ARE_YOU = /\b(qui (es|est|etes|êtes) ?(tu|vous)|t es qui|tu es qui|c est quoi (cet|cette|l )?assistant|who are you|what are you|chkoun enti|chkounek)\b/;
const HELP = /\b(aide|aidez moi|help|que (peux|sais|pouvez|savez) ?(tu|vous) faire|qu est ce que tu (peux|sais) faire|what can you do|tu fais quoi|tu sers a quoi|a quoi tu sers|comment (ca|ça) marche|menu|options)\b/;

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[’'?!.,;:]/g, " ").replace(/\s+/g, " ").trim();

export function detectSmallTalk(message: string): SmallTalk | null {
  const plain = norm(message);
  if (plain.length <= 60) {
    if (HOW_ARE_YOU.test(plain)) return "howAreYou";
    if (WHO_ARE_YOU.test(plain)) return "whoAreYou";
    if (HELP.test(plain)) return "help";
  }
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
