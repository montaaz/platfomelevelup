import { contentTokens, termMatches } from "../core/normalize";
import type { Lang } from "../core/language";
import type { ProductDTO } from "../data/types";
import type { LocalModel } from "./model";
import site from "./site-knowledge.json";

/**
 * Connaissances publiques de l'assistant : contenu du site vitrine (extrait
 * par scripts/buddy-knowledge.mjs), offres lues en direct dans la table
 * `packs`, et un mode d'emploi de l'espace client. Aucune donnée de client
 * ici — celles-ci passent par facts.ts, sous le cloisonnement du compte.
 *
 * La recherche combine des mots (tolérant aux fautes, comme le routeur) et,
 * quand le modèle d'embeddings est disponible, la proximité de sens — utile
 * pour une question en anglais sur un texte français, ou pour un synonyme.
 */

export type Chunk = { id: string; lang: Lang; title: string; text: string };

const SITE: Chunk[] = (site.chunks as { id: string; lang: string; title: string; text: string }[])
  .filter((c): c is Chunk => c.lang === "fr" || c.lang === "en");

/** Mode d'emploi de l'espace client — uniquement ce que les pages font réellement. */
const GUIDE: Record<Lang, [string, string][]> = {
  fr: [
    ["Espace client : Mes projets", "La page Mes projets (accueil de l'espace) montre le projet en cours : statut, étapes franchies, échéance, livrables à télécharger. Quand un livrable attend votre validation, vous pouvez l'approuver ou demander une révision depuis cette page."],
    ["Espace client : Messages", "La page Messages contient une conversation par projet avec l'équipe Level Up IA. Vous pouvez y poser vos questions, envoyer des précisions ou des fichiers."],
    ["Espace client : Mes factures", "La page Mes factures liste vos factures avec leur statut (en attente, payée, en retard) et leur échéance."],
    ["Espace client : paiement d'une commande", "Après le choix d'un pack, la commande et le projet restent « en attente de paiement » jusqu'à ce que l'équipe confirme la réception du paiement. Moyens de paiement enregistrés par l'équipe : virement, carte, espèces, chèque ou paiement en ligne. Le projet démarre une fois le paiement confirmé."],
    ["Espace client : Nouveau projet", "La page Nouveau projet permet de décrire un besoin ou de demander un devis. La demande arrive directement chez l'équipe, qui revient vers vous avec une proposition."],
    ["Espace client : Historique et profil", "La page Historique regroupe les projets passés. La page Mon profil contient vos coordonnées (entreprise, téléphone, adresse) ; le mot de passe se change depuis le bouton Mot de passe du menu."],
  ],
  en: [
    ["Client space: My projects", "The My projects page (home of the space) shows the current project: status, completed steps, due date and deliverables to download. When a deliverable awaits your approval, you can approve it or request a revision from this page."],
    ["Client space: Messages", "The Messages page holds one conversation per project with the Level Up IA team. You can ask questions, send details or files there."],
    ["Client space: My invoices", "The My invoices page lists your invoices with their status (pending, paid, overdue) and due date."],
    ["Client space: paying an order", "After choosing a pack, the order and the project stay \"awaiting payment\" until the team confirms the payment was received. Payment methods recorded by the team: bank transfer, card, cash, cheque or online payment. The project starts once payment is confirmed."],
    ["Client space: New project", "The New project page lets you describe a need or ask for a quote. The request goes straight to the team, who come back to you with a proposal."],
    ["Client space: History and profile", "The History page groups past projects. The My profile page holds your details (company, phone, address); the password is changed from the Password button in the menu."],
  ],
};

export function guideChunks(lang: Lang): Chunk[] {
  return GUIDE[lang].map(([title, text], i) => ({ id: `guide:${lang}:${i}`, lang, title, text }));
}

export function productChunks(products: ProductDTO[], lang: Lang, money: (n: number) => string): Chunk[] {
  const fr = lang === "fr";
  return products.map((p) => ({
    id: `pack:${p.code}`,
    lang,
    title: p.name,
    text: [
      `${p.name} : ${money(p.price)}${p.isMonthly ? (fr ? " par mois" : " per month") : ""}.`,
      p.tagline,
      p.description,
      p.includes.length ? `${fr ? "Comprend" : "Includes"} : ${p.includes.join(" ; ")}.` : null,
    ].filter(Boolean).join(" "),
  }));
}

/** Tout ce que l'assistant peut citer, dans la langue de la réponse. */
export function publicKnowledge(products: ProductDTO[], lang: Lang, money: (n: number) => string): Chunk[] {
  return [...productChunks(products, lang, money), ...guideChunks(lang), ...SITE.filter((c) => c.lang === lang)];
}

/* ------------------------------------------------------------ recherche */

const vectors = new Map<string, number[]>();
let embedding: Promise<void> | null = null;

const keyOf = (c: Chunk) => `${c.id}#${c.text.length}:${c.text.slice(0, 40)}`;

/** Calcule en arrière-plan les vecteurs manquants. Sans attente : la recherche par mots sert en attendant. */
export function warmEmbeddings(model: LocalModel, chunks: Chunk[]): void {
  const missing = chunks.filter((c) => !vectors.has(keyOf(c)));
  if (missing.length === 0 || embedding) return;
  embedding = model
    .embed(missing.map((c) => `${c.title}. ${c.text}`), 120_000)
    .then((vecs) => { vecs?.forEach((v, i) => vectors.set(keyOf(missing[i]!), v)); })
    .catch((e) => console.error("[buddy-ai] embeddings indisponibles:", e instanceof Error ? e.message : e))
    .finally(() => { embedding = null; });
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) { dot += a[i]! * b[i]!; na += a[i]! ** 2; nb += b[i]! ** 2; }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

/** Score par mots : chaque mot de la question présent dans l'extrait, pondéré par sa rareté. */
function lexicalScores(question: string, chunks: Chunk[]): number[] {
  const q = [...new Set(contentTokens(question))];
  const docs = chunks.map((c) => new Set(contentTokens(`${c.title} ${c.text}`)));
  const hit = (doc: Set<string>, t: string) => [...doc].some((w) => termMatches(w, t) || termMatches(t, w));
  const df = new Map(q.map((t) => [t, docs.filter((d) => hit(d, t)).length]));
  return docs.map((doc) => q.reduce((s, t) => (hit(doc, t) ? s + Math.log(1 + chunks.length / (1 + df.get(t)!)) : s), 0));
}

/** Les extraits les plus proches de la question, meilleurs d'abord. */
export async function retrieve(question: string, chunks: Chunk[], k: number, model?: LocalModel | null): Promise<Chunk[]> {
  if (chunks.length === 0) return [];
  const lexical = lexicalScores(question, chunks);
  const maxLex = Math.max(...lexical, 1e-9);
  let semantic: number[] | null = null;
  if (model && chunks.every((c) => vectors.has(keyOf(c)))) {
    const q = await model.embed([question], 5_000).catch(() => null);
    if (q?.[0]) semantic = chunks.map((c) => cosine(q[0]!, vectors.get(keyOf(c))!));
  } else if (model) {
    warmEmbeddings(model, chunks);
  }
  const scored = chunks.map((c, i) => ({
    c,
    s: semantic ? semantic[i]! + 0.25 * (lexical[i]! / maxLex) : lexical[i]!,
  }));
  const floor = semantic ? 0.35 : 0.5;
  return scored.filter((x) => x.s >= floor).sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.c);
}
