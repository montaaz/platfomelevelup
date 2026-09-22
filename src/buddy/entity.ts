/**
 * Détecte si un message vise une autre entité que l'utilisateur lui-même.
 *
 * C'est la pièce maîtresse du cloisonnement : un client peut poser toutes
 * les questions approuvées, mais uniquement sur son propre compte. Dès qu'il
 * nomme quelqu'un d'autre — « les commandes de Boutique Nour », « un autre
 * client » —, la demande est refusée avant toute lecture en base. Pour un
 * administrateur, le nom devient un filtre paramétré.
 *
 * L'analyse porte sur le message brut : la casse compte, un nom propre
 * s'écrit avec une majuscule.
 */

export type EntityRef = { kind: "others" } | { kind: "named"; name: string } | null;

/** Formulations qui désignent d'autres comptes, sans en nommer un. */
const OTHERS = [
  /\bautres?\s+(clients?|comptes?|soci[ée]t[ée]s?|entreprises?)\b/i,
  /\btous\s+les\s+(clients|comptes)\b/i,
  /\bd[’']autres\s+(clients|comptes)\b/i,
  /\b(an)?other\s+(tenant|client|company|customer|account)s?\b/i,
  /\ball\s+(tenants|clients|customers|companies|accounts)\b/i,
];

/** Mots à majuscule qui ne sont pas des noms de client. */
const NOT_A_NAME = new Set([
  "je", "mes", "mon", "ma", "nous", "vous", "le", "la", "les", "un", "une", "des",
  "pack", "packs", "projet", "projets", "facture", "factures", "commande", "commandes",
  "tnd", "dt", "levelup", "level",
  "janvier", "fevrier", "février", "mars", "avril", "mai", "juin", "juillet", "aout", "août",
  "septembre", "octobre", "novembre", "decembre", "décembre",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december",
  "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche",
]);

const CAPITALIZED = "[A-ZÀ-ÝÆŒ][\\wÀ-ÿæœ'’-]*";
const NAMED_AFTER = new RegExp(
  `\\b(?:de|du|des|d[’']|pour|chez|client|cliente|soci[ée]t[ée]|entreprise|company|customer|of|for)\\s+(${CAPITALIZED}(?:\\s+${CAPITALIZED})*)`,
);
const QUOTED = /[«"“]\s*([^»"”]{2,80}?)\s*[»"”]/;

export function extractEntity(raw: string): EntityRef {
  const message = raw.trim();
  if (!message) return null;

  if (OTHERS.some((re) => re.test(message))) return { kind: "others" };

  const quoted = QUOTED.exec(message);
  if (quoted?.[1]) {
    // « projet « Vidéo IA » » ou « facture « F-2026-041 » » désignent un
    // élément du compte, pas un autre client.
    const before = message.slice(0, quoted.index);
    if (!/\b(projet|project|facture|invoice|commande|order|fichier|file)\s*$/i.test(before)) {
      return { kind: "named", name: quoted[1].trim() };
    }
  }

  const named = NAMED_AFTER.exec(message);
  if (named?.[1]) {
    const words = named[1].split(/\s+/).filter((w) => !NOT_A_NAME.has(w.toLowerCase()));
    if (words.length > 0) return { kind: "named", name: words.join(" ") };
  }

  return null;
}
