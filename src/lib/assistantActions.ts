/**
 * Actions que l'assistant peut PROPOSER à un client (jamais exécuter seul).
 *
 * Liste fermée, volontairement limitée à ce qu'un client peut déjà faire
 * lui-même dans son espace, avec ses propres droits :
 *   - ADD_TO_CART     : ajouter une offre → commande « en attente de paiement »
 *                       (le paiement reste vérifié et validé par l'équipe) ;
 *   - CREATE_REQUEST  : envoyer une demande de projet / devis à l'équipe ;
 *   - SEND_MESSAGE    : écrire à l'équipe sur un de ses projets.
 * Tout ce qui relève de l'équipe (valider un paiement, changer un statut,
 * remise, annulation, suppression…) est refusé et proposé en transmission.
 *
 * Chaque action est exécutée uniquement après un « Confirmer » explicite du
 * client (bouton ou « oui » à l'oral), côté serveur, avec sa session.
 * Fonctions pures, testées à part.
 */

export type ProductLite = { code: string; name: string; price: number; isMonthly: boolean; position?: number };
export type ProjectLite = { id: string; title: string };

export type Proposal =
  | { action: "ADD_TO_CART"; packCode: string; label: string; summary: string }
  | { action: "CREATE_REQUEST"; title: string; description: string; label: string; summary: string }
  | { action: "SEND_MESSAGE"; projectId: string | null; projectTitle: string | null; body: string; choices?: ProjectLite[]; label: string; summary: string };

export type Detection = { kind: "proposal"; proposal: Proposal } | { kind: "admin-only"; reason: string } | null;

export const ALLOWED_ACTIONS = ["ADD_TO_CART", "CREATE_REQUEST", "SEND_MESSAGE"] as const;
export type AllowedAction = (typeof ALLOWED_ACTIONS)[number];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, " ").replace(/\s+/g, " ").trim();

const GENERIC = new Set(["pack", "abonnement", "express", "et", "de", "des", "la", "le", "les", "du", "d", "en", "un", "une", "the", "a", "an"]);

/** Demandes qui relèvent de l'équipe : jamais exécutées par l'assistant. */
const ADMIN_ONLY =
  /\b(valide[rz]?|validation|confirme[rz]? (le |mon |un )?(paiement|virement|reglement)|change[rz]? (le |mon )?statut|statut (du |de mon )?projet|supprime[rz]?|suppression|approuve[rz]?|rembourse[rz]?|remboursement|remise|reduction|promo|gratuit|annule[rz]? (ma |la |une )?commande|modifie[rz]? (le |mon )?(prix|tarif|montant)|prolonge[rz]?|delai|acces admin|mot de passe de|delete|refund|discount|approve|cancel (my |the )?order|change (the )?(status|price)|free)\b/;

const ADD_VERBS = /\b(ajoute[rz]?|rajoute[rz]?|mets?|mettre|commande[rz]?|achete[rz]?|acheter|prend(re|s)?|je veux|je voudrais|souhaite|panier|add|order|buy|take|want)\b/;
const REQUEST_WORDS = /\b(nouveau projet|nouvelle demande|demande de projet|demande de devis|un devis|devis pour|besoin d un devis|new project|a quote|request a quote|quote for)\b/;
/** Destinataires : l'équipe sous tous ses noms. */
const TEAM = "(l ?equipe|l ?admin|l ?administrateur|l ?administratrice|les admins|le responsable|la responsable|le staff|l ?agence|level ?up|the team|the admin|the administrator|the staff|the agency|them|support|le support)";
const MESSAGE_WORDS = new RegExp(
  "\\b(" +
    // verbe de communication + destinataire : « dis à l'équipe », « tell the admin », « préviens le responsable »
    "(dis|dites|dire|envoie|envoyer|envoies|ecris|ecrire|transmets|transmettre|previens|prevenir|previens|informe|informer|informez|signale|signaler|signalez|demande|demander|demandez|rappelle|rappeler|explique|expliquer|fais savoir|faites savoir|tell|inform|notify|remind|ask|let|message|write to|send)" +
    "( un| une| le| la| lui| leur| moi| svp| please| s il te plait| s il vous plait)?( message| mot| mail| e mail| note| word)?( a| à| au| aux| pour| to)?( que)? ?" + TEAM +
    "( know| savoir)?" +
  "|message (a |pour |to )?" + TEAM +
  "|(tell|inform|notify) (them|him|her)" +
  "|(contacte|contactez|contact|joindre|joins) " + TEAM +
  ")\\b",
);

export function isConfirmation(text: string): boolean {
  return /^(oui|ok|okay|d accord|daccord|confirme|confirmer|je confirme|vas y|allez y|go|yes|yep|yeah|sure|c est bon|valide|parfait|exact|tout a fait)\b/.test(norm(text));
}
export function isDenial(text: string): boolean {
  return /^(non|nan|annule|annuler|no|nope|cancel|laisse tomber|pas maintenant|stop|arrete)\b/.test(norm(text));
}

/** Offre désignée dans la phrase : nom (mots significatifs), ou « pack 1 / pack 01 ». */
export function matchProduct(text: string, products: ProductLite[]): ProductLite | null {
  const t = ` ${norm(text)} `;
  const byPosition = t.match(/\bpack 0?([1-9])\b/);
  if (byPosition) {
    const pos = Number(byPosition[1]);
    const p = products.find((x) => x.position === pos && /^pack/i.test(x.name));
    if (p) return p;
  }
  let best: { p: ProductLite; score: number; len: number } | null = null;
  for (const p of products) {
    const words = norm(p.name).split(" ").filter((w) => w && !GENERIC.has(w));
    if (words.length === 0) continue;
    const hits = words.filter((w) => t.includes(` ${w} `) || t.includes(` ${w}s `)).length;
    if (hits < words.length) continue; // tous les mots significatifs doivent être là
    const score = hits * 10 + words.length; // un nom plus précis (plus de mots) l'emporte
    if (!best || score > best.score || (score === best.score && p.name.length > best.len)) best = { p, score, len: p.name.length };
  }
  return best?.p ?? null;
}

function money(p: ProductLite): string {
  return `${Math.round(p.price)} DT${p.isMonthly ? " / mois" : ""}`;
}

/**
 * Lit la phrase du client et renvoie, s'il y a lieu, l'action à lui proposer.
 * `null` : simple question, l'assistant répond normalement.
 */
export function detectProposal(text: string, products: ProductLite[], projects: ProjectLite[], lang: "fr" | "en" = "fr"): Detection {
  const en = lang === "en";
  const t = norm(text);
  if (!t) return null;
  if (ADMIN_ONLY.test(t)) return { kind: "admin-only", reason: "action réservée à l'équipe" };

  // 1. Ajout au panier
  if (ADD_VERBS.test(t)) {
    const p = matchProduct(t, products);
    if (p) {
      return {
        kind: "proposal",
        proposal: {
          action: "ADD_TO_CART",
          packCode: p.code,
          label: en ? `Add ${p.name} to the cart` : `Ajouter ${p.name} au panier`,
          summary: en
            ? `${p.name} (${money(p)}) will be added to your orders, awaiting payment. The payment is then checked by the team.`
            : `${p.name} (${money(p)}) sera ajouté à vos commandes, en attente de paiement. Le règlement est ensuite vérifié par l'équipe.`,
        },
      };
    }
  }

  // 2. Message à l'équipe sur un projet
  const m = t.match(MESSAGE_WORDS);
  if (m) {
    // Le message transmis est la phrase complète du client (son intention est claire ainsi), sans la formule d'adresse si elle commence la phrase.
    const lead = (m.index ?? 0) === 0 ? m[0].length : 0;
    const after = t.slice(lead).replace(/^[\s:,]*(que|qu|de|that|to)\s+/, "").trim();
    const body = (lead && after.length >= 8 ? text.trim().slice(text.trim().length - after.length) : text).trim();
    const named = projects.find((p) => t.includes(norm(p.title)));
    const chosen = named ?? (projects.length === 1 ? projects[0]! : null);
    return {
      kind: "proposal",
      proposal: {
        action: "SEND_MESSAGE",
        projectId: chosen?.id ?? null,
        projectTitle: chosen?.title ?? null,
        body,
        choices: chosen ? undefined : projects,
        label: en ? "Send this message to the team" : "Envoyer ce message à l'équipe",
        summary: en
          ? (chosen ? `Message on project “${chosen.title}”: “${body}”.` : `Message to the team: “${body}” — choose the project.`)
          : (chosen ? `Message sur le projet « ${chosen.title} » : « ${body} ».` : `Message à l'équipe : « ${body} » — choisissez le projet concerné.`),
      },
    };
  }

  // 3. Demande de projet / devis
  if (REQUEST_WORDS.test(t)) {
    const title = text.replace(/\s+/g, " ").trim().slice(0, 80);
    return {
      kind: "proposal",
      proposal: {
        action: "CREATE_REQUEST",
        title,
        description: text.trim().slice(0, 2000),
        label: en ? "Send the request to the team" : "Envoyer la demande à l'équipe",
        summary: en
          ? `A project request will be sent to the team: “${title}”. They will reply with a proposal.`
          : `Une demande de projet sera envoyée à l'équipe : « ${title} ». Elle vous répond avec une proposition.`,
      },
    };
  }
  return null;
}

/** Phrase de confirmation lue au client avant toute exécution. */
export function proposalPrompt(p: Proposal, lang: "fr" | "en" = "fr"): string {
  if (lang === "en") return `${p.summary} Do you confirm?`;
  return `${p.summary} Confirmez-vous ?`;
}

/** Réponse quand la demande relève de l'équipe. */
export function adminOnlyMessage(lang: "fr" | "en" = "fr"): string {
  return lang === "en"
    ? "This needs the Level Up IA team: I can't do it myself. I can pass your request on to them, do you confirm?"
    : "Cette action relève de l'équipe Level Up IA : je ne peux pas la faire moi-même. Je peux transmettre votre demande à l'équipe, confirmez-vous ?";
}
