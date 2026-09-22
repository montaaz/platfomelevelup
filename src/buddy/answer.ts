import { route } from "./core/router";
import { detectSmallTalk } from "./core/smalltalk";
import { tokenize, termMatches } from "./core/normalize";
import { paragraphs } from "./core/templates";
import { extractEntity } from "./entity";
import { extractFilters, STATUS_TOKENS, type Filters, type StatusToken } from "./filters";
import { INTENTS, INTENT_IDS, SUGGESTIONS, type BuddyIntentId } from "./intents";
import {
  INTENT_LABELS, REFUSALS, SMALLTALK, renderInvoiceDetail, renderInvoices, renderNewProject, renderOrderDetail,
  renderOrders, renderProducts, renderProjectDetail, renderProjects, renderReview, renderSummary, renderTasks,
  renderThreadDetail, renderThreads, reviewFooter, type Action,
} from "./templates";
import type { BuddyCtx, BuddyDataSource, QueryFilter } from "./data/types";

/**
 * Orchestrateur du Dashboard Buddy.
 *
 * Message + session (+ contexte du tour précédent) → politesse → entité
 * visée → filtres → intention → lecture → gabarit. À chaque étape, un refus
 * explicite plutôt qu'une supposition : question inconnue, ambiguë, entité
 * interdite, aucune donnée. Quand les données sont incomplètes, la réponse
 * le dit au lieu de les présenter comme fiables.
 *
 * La mémoire tient en un tour : la réponse renvoie un `context` (intention
 * et filtres retenus) que le widget renvoie au message suivant. « et les
 * payées ? » prolonge alors la question précédente. Ce contexte vient du
 * navigateur : il est revalidé champ par champ avant tout usage.
 */

export type BuddyContext = { intent: BuddyIntentId; filter?: SerializedFilter };
export type SerializedFilter = {
  company?: string; status?: StatusToken; since?: string; until?: string; label?: string;
  reference?: string; name?: string; limit?: number;
};

export type BuddyResult = {
  kind: "answer" | "refusal" | "review";
  text: string;
  suggestions?: string[];
  /** Nombre d'enregistrements signalés pour vérification manuelle. */
  reviewCount?: number;
  /** À renvoyer avec le message suivant pour permettre une question de suivi. */
  context?: BuddyContext;
  /** Boutons vers une page de l'espace — toujours des chemins internes. */
  actions?: Action[];
};

const MAX_CHARS = 1500;
const MAX_TEXT = 80;
const FIVE_YEARS = 5 * 365 * 86_400_000;

/* ------------------------------------------------------------ contexte */

/**
 * Le contexte renvoyé par le navigateur n'est pas cru : chaque champ est
 * vérifié — intention connue, statut de la liste fermée, dates plausibles,
 * textes bornés. Un champ douteux est écarté, jamais interprété.
 */
export function parseContext(raw: unknown, now: Date = new Date()): BuddyContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  if (typeof c.intent !== "string" || !(INTENT_IDS as string[]).includes(c.intent)) return undefined;
  const out: BuddyContext = { intent: c.intent as BuddyIntentId };
  if (c.filter && typeof c.filter === "object") {
    const f = c.filter as Record<string, unknown>;
    const filter: SerializedFilter = {};
    const text = (v: unknown) => (typeof v === "string" && v.trim() && v.length <= MAX_TEXT ? v.trim() : undefined);
    const date = (v: unknown) => {
      if (typeof v !== "string") return undefined;
      const t = new Date(v).getTime();
      return Number.isFinite(t) && Math.abs(t - now.getTime()) < FIVE_YEARS ? new Date(t).toISOString() : undefined;
    };
    if (text(f.company)) filter.company = text(f.company);
    if (typeof f.status === "string" && (STATUS_TOKENS as string[]).includes(f.status)) filter.status = f.status as StatusToken;
    if (date(f.since)) filter.since = date(f.since);
    if (date(f.until)) filter.until = date(f.until);
    if (text(f.label)) filter.label = text(f.label);
    if (typeof f.reference === "string" && /^F-\d{4}-\d{3,4}$/i.test(f.reference)) filter.reference = f.reference.toUpperCase();
    if (text(f.name)) filter.name = text(f.name);
    if (typeof f.limit === "number" && Number.isInteger(f.limit) && f.limit > 0 && f.limit <= 50) filter.limit = f.limit;
    if (Object.keys(filter).length) out.filter = filter;
  }
  return out;
}

const serialize = (f: QueryFilter): SerializedFilter | undefined => {
  const s: SerializedFilter = {
    company: f.company, status: f.status, since: f.since?.toISOString(), until: f.until?.toISOString(),
    label: f.label, reference: f.reference, name: f.name, limit: f.limit,
  };
  const clean = Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as SerializedFilter;
  return Object.keys(clean).length ? clean : undefined;
};

const deserialize = (f?: SerializedFilter): QueryFilter => ({
  company: f?.company, status: f?.status, since: f?.since ? new Date(f.since) : undefined,
  until: f?.until ? new Date(f.until) : undefined, label: f?.label, reference: f?.reference, name: f?.name, limit: f?.limit,
});

/* ------------------------------------------------------------ réponse */

export async function answerBuddy(
  ctx: BuddyCtx,
  rawMessage: string,
  source: BuddyDataSource,
  previous?: BuddyContext,
  now: Date = new Date(),
): Promise<BuddyResult> {
  const message = (rawMessage ?? "").slice(0, MAX_CHARS);
  const suggestions = SUGGESTIONS[ctx.role];
  const isAdmin = ctx.role === "ADMIN";

  const talk = detectSmallTalk(message);
  if (talk === "greeting") return { kind: "answer", text: SMALLTALK.greeting(ctx.fullName.split(" ")[0] ?? "", suggestions), suggestions, context: previous };
  if (talk === "thanks") return { kind: "answer", text: SMALLTALK.thanks, context: previous };
  if (talk === "bye") return { kind: "answer", text: SMALLTALK.bye };

  // Permission d'abord : un client qui vise une autre entité que lui-même est
  // refusé avant toute autre analyse, quelle que soit la question posée.
  const entity = extractEntity(message);
  if (!isAdmin && entity) {
    return { kind: "refusal", text: REFUSALS.unauthorized, context: previous };
  }

  const found = extractFilters(message, now);
  const routed = route(message, INTENTS);

  // Une intention nette dans le message l'emporte ; sinon, un message court
  // qui n'apporte que des précisions prolonge la question précédente.
  let intent: BuddyIntentId;
  let filter: QueryFilter;
  const refines = previous && (found.connector || tokenize(message).length <= 4) && hasDetail(found, entity);
  if (routed.kind === "match") {
    intent = routed.id;
    filter = fromFilters(found, isAdmin && entity?.kind === "named" ? entity.name : undefined);
  } else if (refines) {
    intent = previous.intent;
    filter = { ...deserialize(previous.filter), ...fromFilters(found, isAdmin && entity?.kind === "named" ? entity.name : undefined) };
  } else if (routed.kind === "ambiguous") {
    const labels = routed.ids.map((id) => INTENT_LABELS[id] ?? id);
    return { kind: "refusal", text: REFUSALS.ambiguous(labels), suggestions: labels, context: previous };
  } else {
    return { kind: "refusal", text: REFUSALS.unsupported(suggestions), suggestions, context: previous };
  }

  // Une facture nommée ou un projet nommé se lisent en détail, quelle que
  // soit l'intention détectée autour.
  if (filter.reference && intent !== "review") intent = "invoices";
  if (filter.name && (intent === "summary" || intent === "project")) intent = "project";

  const result = await render(intent, ctx, message, source, filter, found.ordinal, suggestions);
  return { ...result, context: { intent, filter: serialize(filter) } };
}

const hasDetail = (f: Filters, entity: ReturnType<typeof extractEntity>) =>
  !!(f.status || f.since || f.reference || f.name || f.ordinal || f.limit || entity);

const fromFilters = (f: Filters, company?: string): QueryFilter => {
  const q: QueryFilter = {
    company, status: f.status, since: f.since, until: f.until, label: f.label,
    reference: f.reference, name: f.name, limit: f.limit,
  };
  return Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined)) as QueryFilter;
};

/** L'élément désigné par « la 2ᵉ », « la dernière » — ou rien si hors liste. */
function pick<T>(items: T[], ordinal: number): T | undefined {
  if (ordinal === -1) return items.at(-1);
  return ordinal >= 1 ? items[ordinal - 1] : undefined;
}

async function render(
  id: BuddyIntentId,
  ctx: BuddyCtx,
  message: string,
  source: BuddyDataSource,
  filter: QueryFilter,
  ordinal: number | undefined,
  suggestions: string[],
): Promise<Omit<BuddyResult, "context">> {
  const showCompany = ctx.role === "ADMIN";
  const noItem = (count: number) => ({ kind: "refusal" as const, text: REFUSALS.noSuchItem(ordinal ?? 0, count) });

  switch (id) {
    case "help":
      return { kind: "answer", text: REFUSALS.help(suggestions), suggestions };

    case "newProject": {
      const { text, actions } = renderNewProject(ctx.role);
      return { kind: "answer", text, actions };
    }

    case "summary":
      return { kind: "answer", text: renderSummary(await source.summary(ctx)) };

    case "orders": {
      const orders = await source.orders(ctx, filter);
      if (orders.length === 0) return { kind: "refusal", text: REFUSALS.noEvidence };
      if (ordinal) {
        const one = pick(orders, ordinal);
        return one ? withReview(renderOrderDetail(one, showCompany), [], showCompany) : noItem(orders.length);
      }
      const flagged = orders.filter((o) => o.review.length > 0).map((o) => ({ ref: `${o.packName} (#${o.id})`, clientCompany: o.clientCompany, reasons: o.review }));
      return withReview(renderOrders(orders, showCompany, filter), flagged, showCompany);
    }

    case "products": {
      const products = await source.products();
      if (products.length === 0) return { kind: "refusal", text: REFUSALS.noEvidence };
      const mentionsStock = tokenize(message).some((t) => termMatches(t, "stock"));
      return { kind: "answer", text: renderProducts(products, mentionsStock) };
    }

    case "review": {
      const items = await source.reviewItems(ctx, filter);
      return { kind: items.length ? "review" : "answer", text: renderReview(items, showCompany), reviewCount: items.length };
    }

    case "threads": {
      const threads = await source.threads(ctx, filter);
      if (threads.length === 0) return { kind: "refusal", text: REFUSALS.noEvidence };
      if (ordinal) {
        const one = pick(threads, ordinal);
        return one ? { kind: "answer", text: renderThreadDetail(one, showCompany) } : noItem(threads.length);
      }
      return { kind: "answer", text: renderThreads(threads, showCompany, filter) };
    }

    case "tasks":
      return { kind: "answer", text: renderTasks(await source.tasks(ctx, filter), showCompany) };

    case "invoices": {
      const invoices = await source.invoices(ctx, filter);
      if (invoices.length === 0) return { kind: "refusal", text: REFUSALS.noEvidence };
      if (filter.reference || ordinal) {
        const one = ordinal ? pick(invoices, ordinal) : invoices[0];
        if (!one) return noItem(invoices.length);
        const flagged = one.review.length ? [{ ref: one.number, clientCompany: one.clientCompany, reasons: one.review }] : [];
        return { kind: flagged.length ? "review" : "answer", text: renderInvoiceDetail(one, showCompany), reviewCount: flagged.length };
      }
      const flagged = invoices.filter((i) => i.review.length > 0).map((i) => ({ ref: i.number, clientCompany: i.clientCompany, reasons: i.review }));
      return withReview(renderInvoices(invoices, showCompany, filter), flagged, showCompany);
    }

    case "project": {
      const projects = await source.projects(ctx, filter);
      if (projects.length === 0) return { kind: "refusal", text: REFUSALS.noEvidence };
      if (filter.name || ordinal || projects.length === 1) {
        const one = ordinal ? pick(projects, ordinal) : projects[0];
        return one ? { kind: "answer", text: renderProjectDetail(one, showCompany) } : noItem(projects.length);
      }
      return { kind: "answer", text: renderProjects(projects, showCompany, filter) };
    }
  }
}

/** Ajoute le pied « à vérifier » quand des enregistrements sont incomplets. */
function withReview(text: string, flagged: { ref: string; clientCompany?: string; reasons: string[] }[], showCompany: boolean): Omit<BuddyResult, "context"> {
  if (flagged.length === 0) return { kind: "answer", text };
  return { kind: "review", text: paragraphs(text, reviewFooter(flagged, showCompany)), reviewCount: flagged.length };
}
