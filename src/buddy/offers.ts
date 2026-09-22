import { contentTokens, normalize, termMatches, tokenize } from "./core/normalize";
import { bullets, paragraphs } from "./core/templates";
import type { ProductDTO } from "./data/types";
import type { Strings } from "./locales";
import type { Action } from "./templates";

/**
 * Les offres, en détail : un pack nommé, un conseil selon un besoin ou un
 * budget, une comparaison. Tout est lu dans la table `packs` — nom, prix,
 * contenu, accroche — et rien n'est estimé : quand une offre ne mentionne
 * pas ce que le client cherche, le bot le dit et renvoie vers l'équipe.
 */

export type OfferReply = { text: string; actions?: Action[] };

/** Mots qui ne désignent ni une offre ni un besoin. */
const NOISE = new Set([
  "pack", "packs", "offre", "offres", "offer", "offers", "prix", "price", "tarif", "tarifs", "budget", "tnd", "dinars", "details", "detail",
  "plus", "mieux", "meilleur", "meilleure", "better", "best", "want", "need", "veux", "voudrais", "besoin",
  "business", "entreprise", "boutique", "societe", "company", "think", "pense", "pensez", "conseil", "conseille",
  "conseiller", "conseillez", "recommend", "recommande", "recommandez", "which", "quel", "quelle", "quels", "more",
  "about", "pour", "new", "nouveau", "nouvelle", "stock", "catalogue", "produit", "produits", "service", "services",
  "abonnement", "abonnements", "mois", "month", "formule", "cher", "chere", "expensive", "cheap", "faire", "make",
  "have", "like", "know", "savoir", "info", "infos", "information", "informations", "nechri", "commandi", "commander",
  "acheter", "achete", "buy", "order", "purchase", "souscrire", "subscribe",
]);

/** Mots génériques d'un nom d'offre, qui ne la distinguent pas. */
const GENERIC = new Set(["pack", "abonnement", "gestion", "des", "de", "les"]);

/** Une offre désignée par son nom (« découverte », « pro max ») ou son rang (« pack 01 », « pack 3 »). */
export function findNamedOffers(message: string, products: ProductDTO[]): ProductDTO[] {
  const n = ` ${normalize(message)} `;
  const found: ProductDTO[] = [];
  for (const p of products) {
    const alias = contentTokens(p.name).filter((w) => !GENERIC.has(w));
    if (alias.length && n.includes(` ${alias.join(" ")} `)) found.push(p);
  }
  const rank = /\bpack\s+0?(\d)\b/.exec(n);
  if (rank) {
    const p = products.find((x) => x.position === Number(rank[1]));
    if (p && !found.includes(p)) found.push(p);
  }
  return found;
}

/** Un montant suivi d'une devise, ou introduit par « budget ». */
export function findBudget(message: string): number | null {
  const n = normalize(message);
  const amount = "(\\d{1,3}(?: \\d{3})+|\\d{3,6})";
  const m =
    new RegExp(`\\b${amount}\\s*(?:dt|tnd|dinars?|d)\\b`).exec(n) ??
    new RegExp(`\\b(?:budget|j ai|jai|i have|dispose de|maximum|max|jusqu a|up to|environ|around|about)\\s*(?:de|d|of|is|est|un|a)?\\s*${amount}\\b`).exec(n);
  if (!m?.[1]) return null;
  const value = Number(m[1].replace(/\s/g, ""));
  return value >= 100 && value <= 1_000_000 ? value : null;
}

export type NeedMatch = { need: string; matches: { product: ProductDTO; line: string }[] };

/** « shooting », « vidéos », « site » : les offres dont le contenu le mentionne. */
export function findByNeed(message: string, products: ProductDTO[]): NeedMatch | null {
  const needTokens = contentTokens(message).filter((t) => !NOISE.has(t));
  if (needTokens.length === 0) return null;
  const hit = (text: string) => contentTokens(text).some((w) => needTokens.some((t) => termMatches(w, t) || termMatches(t, w)));
  const matches: NeedMatch["matches"] = [];
  const matchedTokens = new Set<string>();
  for (const product of products) {
    const line = [...product.includes, product.description ?? ""].find((l) => l && hit(l))
      ?? (hit(product.name) ? (product.description ?? product.name) : undefined);
    if (line) {
      matches.push({ product, line });
      for (const t of needTokens) if (contentTokens(line).some((w) => termMatches(w, t) || termMatches(t, w))) matchedTokens.add(t);
    }
  }
  if (matches.length === 0) return null;
  return { need: [...matchedTokens].join(", "), matches };
}

export function answerOffers(t: Strings, message: string, products: ProductDTO[], role: "ADMIN" | "CLIENT"): OfferReply {
  const o = t.offers;
  const priceOf = (p: ProductDTO) => `${t.money(p.price)}${p.isMonthly ? o.perMonth : ""}`;
  const line = (p: ProductDTO) => `${p.name} · ${priceOf(p)}${p.description ? ` — ${p.description}` : ""}`;
  const footer = role === "CLIENT" ? t.offersFooter : null;
  const advise: Action[] | undefined = role === "CLIENT" ? [{ label: t.actions.messages, href: "/client/messages" }] : undefined;

  const named = findNamedOffers(message, products);
  const need = findByNeed(message, products);

  if (named.length >= 2) {
    const [a, b] = [named[0]!, named[1]!];
    const key = (s: string) => normalize(s);
    const inA = new Set(a.includes.map(key)); const inB = new Set(b.includes.map(key));
    return {
      text: paragraphs(
        o.compare,
        `${a.name} · ${priceOf(a)}\n${b.name} · ${priceOf(b)}`,
        a.includes.some((l) => inB.has(key(l))) ? `${o.both}\n${bullets(a.includes.filter((l) => inB.has(key(l))))}` : null,
        a.includes.some((l) => !inB.has(key(l))) ? `${o.onlyIn(a.name)}\n${bullets(a.includes.filter((l) => !inB.has(key(l))))}` : null,
        b.includes.some((l) => !inA.has(key(l))) ? `${o.onlyIn(b.name)}\n${bullets(b.includes.filter((l) => !inA.has(key(l))))}` : null,
      ),
    };
  }

  if (named.length === 1) {
    const p = named[0]!;
    const others = need?.matches.filter((m) => m.product.code !== p.code) ?? [];
    return {
      text: paragraphs(
        `${p.name} · ${priceOf(p)}`,
        p.tagline,
        p.includes.length ? `${o.includes}\n${bullets(p.includes)}` : p.description,
        others.length && need ? `${o.others(need.need)}\n${bullets(others.map((m) => `${m.product.name} · ${priceOf(m.product)} — ${m.line}`))}` : null,
        footer,
      ),
      actions: advise,
    };
  }

  const budget = findBudget(message);
  if (budget !== null) {
    const packs = products.filter((p) => !p.isMonthly && p.price <= budget).sort((a, b) => a.price - b.price);
    const subs = products.filter((p) => p.isMonthly && p.price <= budget).sort((a, b) => a.price - b.price);
    const cheapest = Math.min(...products.filter((p) => !p.isMonthly).map((p) => p.price));
    return {
      text: paragraphs(
        packs.length ? `${o.budget(budget)}\n${bullets(packs.map(line))}` : o.budgetNone(budget, cheapest),
        subs.length ? `${o.monthly}\n${bullets(subs.map(line))}` : null,
        footer,
      ),
      actions: advise,
    };
  }

  if (need) {
    return {
      text: paragraphs(o.forNeed(need.need), bullets(need.matches.map((m) => `${m.product.name} · ${priceOf(m.product)} — ${m.line}`)), footer),
      actions: advise,
    };
  }

  const mentionsStock = tokenize(message).some((x) => termMatches(x, "stock"));
  return { text: paragraphs(mentionsStock ? o.noStock : o.list(products.length), bullets(products.map(line)), o.hint) };
}
