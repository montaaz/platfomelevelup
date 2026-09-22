import { contentTokens, tokenize, termMatches } from "./core/normalize";
import { paragraphs } from "./core/templates";
import { isLang, type Lang } from "./core/language";
import { extractEntity } from "./entity";
import { STATUS_TOKENS, type Filters, type StatusToken } from "./filters";
import { INTENTS, INTENT_IDS, PROJECT_INTENTS, type BuddyIntentId } from "./intents";
import { L, type Strings } from "./locales";
import { answerOffers } from "./offers";
import { ruleBasedUnderstander, type Understander } from "./reasoning";
import {
  awaitingDeliverable, renderApprove, renderDeadline, renderDeliverables, renderDownload, renderHuman, renderInvoiceDetail,
  renderInvoices, renderNewProject, renderOrderDetail, renderOrders, renderProjectStatus, renderProjects, renderReview,
  renderRevision, renderSummary, renderTasks, renderTeamMessages, renderThreadDetail, renderThreads, reviewFooter, type Action,
} from "./templates";
import type { BuddyCtx, BuddyDataSource, ProjectDTO, QueryFilter } from "./data/types";

/**
 * Orchestrateur du Dashboard Buddy.
 *
 * Message + session (+ contexte du tour précédent) → langue → politesse →
 * entité visée → intention → projet concerné → lecture → gabarit. À chaque
 * étape, un refus explicite plutôt qu'une supposition ; quand plusieurs
 * projets peuvent être visés, une question plutôt qu'un choix au hasard.
 *
 * Le contexte tient en un tour : intention, filtres, projet en cours, langue,
 * nombre de replis consécutifs. Il vient du navigateur et est revalidé champ
 * par champ avant tout usage — le projet n'y est qu'un identifiant, relu en
 * base sous le cloisonnement du compte.
 */

export type SerializedFilter = {
  company?: string; status?: StatusToken; since?: string; until?: string; label?: string;
  reference?: string; name?: string; limit?: number;
};
export type BuddyContext = {
  intent: BuddyIntentId;
  filter?: SerializedFilter;
  /** Projet dont on parle — « it », « sa date » s'y rapportent. */
  projectId?: string;
  lang?: Lang;
  /** Replis consécutifs : au second, on propose l'équipe. */
  fallbacks?: number;
  /** Une clarification est en attente pour cette intention. */
  pending?: BuddyIntentId;
};

export type BuddyResult = {
  kind: "answer" | "refusal" | "review";
  text: string;
  lang: Lang;
  suggestions?: string[];
  reviewCount?: number;
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
 * textes bornés, identifiant numérique. Un champ douteux est écarté.
 */
export function parseContext(raw: unknown, now: Date = new Date()): BuddyContext | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  if (typeof c.intent !== "string" || !(INTENT_IDS as string[]).includes(c.intent)) return undefined;
  const out: BuddyContext = { intent: c.intent as BuddyIntentId };
  if (typeof c.projectId === "string" && /^\d{1,20}$/.test(c.projectId)) out.projectId = c.projectId;
  if (isLang(c.lang)) out.lang = c.lang;
  if (typeof c.fallbacks === "number" && Number.isInteger(c.fallbacks) && c.fallbacks >= 0 && c.fallbacks <= 5) out.fallbacks = c.fallbacks;
  if (typeof c.pending === "string" && (INTENT_IDS as string[]).includes(c.pending)) out.pending = c.pending as BuddyIntentId;
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
    if (text(f.label) && /^[a-zA-Z:0-9]{1,20}$/.test(f.label as string)) filter.label = text(f.label);
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

const fromFilters = (f: Filters, company?: string): QueryFilter => {
  const q: QueryFilter = { company, status: f.status, since: f.since, until: f.until, label: f.label, reference: f.reference, name: f.name, limit: f.limit };
  return Object.fromEntries(Object.entries(q).filter(([, v]) => v !== undefined)) as QueryFilter;
};

/* ------------------------------------------------------------ projet visé */

/** Mots qui ne désignent pas un projet, même s'ils figurent dans un titre. */
const NOT_A_NAME = new Set(["projet", "projets", "project", "projects", "statut", "status", "avancement", "etape", "etapes", "livrable", "livrables", "fichier", "fichiers", "date", "echeance", "deadline", "livraison", "video", "site"]);
const SERVICE_WORDS = new Set(["video", "videos", "site", "web", "shooting", "photo", "campagne", "logo", "identite", "chatbot", "reservation", "landing", "ecommerce", "commerce"]);
const PRONOUN = /\b(it|its|it s|sa|son|ses|ce|cette|celui|celle|ca|the same|le meme|la meme)\b/;

/** Les projets que le message désigne par leur titre ou leur service. */
function projectsNamed(message: string, projects: ProjectDTO[], explicitName?: string): ProjectDTO[] {
  if (explicitName) {
    const hits = projects.filter((p) => p.title.toLowerCase().includes(explicitName.toLowerCase()));
    if (hits.length) return hits;
  }
  const words = contentTokens(message).filter((w) => !NOT_A_NAME.has(w) || SERVICE_WORDS.has(w));
  if (words.length === 0) return [];
  const scored = projects.map((p) => {
    const own = [...contentTokens(p.title), ...contentTokens(p.serviceName ?? "")];
    const score = words.filter((w) => own.some((o) => termMatches(o, w) || termMatches(w, o))).length;
    return { p, score };
  }).filter((x) => x.score > 0);
  if (scored.length === 0) return [];
  const best = Math.max(...scored.map((x) => x.score));
  return scored.filter((x) => x.score === best).map((x) => x.p);
}

/* ------------------------------------------------------------ réponse */

export async function answerBuddy(
  ctx: BuddyCtx,
  rawMessage: string,
  source: BuddyDataSource,
  previous?: BuddyContext,
  now: Date = new Date(),
  understander: Understander = ruleBasedUnderstander,
): Promise<BuddyResult> {
  const message = (rawMessage ?? "").slice(0, MAX_CHARS).trim();
  const u = understander.understand(message, { intents: INTENTS, previousLang: previous?.lang, now });
  const lang = u.lang;
  const t = L(lang);
  const isAdmin = ctx.role === "ADMIN";
  const carry: BuddyContext | undefined = previous ? { ...previous, lang, fallbacks: 0, pending: undefined } : undefined;
  const suggestions = t.suggestions(ctx.role);

  if (!message) return { kind: "refusal", lang, text: t.notUnderstood("…", []), suggestions, context: carry };

  if (u.smallTalk === "greeting") return { kind: "answer", lang, text: t.greeting(ctx.fullName.split(" ")[0] ?? ""), suggestions, context: carry };
  if (u.smallTalk === "thanks") return { kind: "answer", lang, text: t.thanks, context: carry };
  if (u.smallTalk === "bye") return { kind: "answer", lang, text: t.bye, context: carry ? { ...carry, projectId: undefined } : undefined };

  // Permission d'abord : un client qui vise une autre entité est refusé.
  if (!isAdmin && u.entity) return { kind: "refusal", lang, text: t.unauthorized, context: carry };
  const company = isAdmin && u.entity?.kind === "named" ? u.entity.name : undefined;

  /* --- quelle intention ? --- */
  let intent: BuddyIntentId | undefined;
  let filter: QueryFilter = fromFilters(u.filters, company);
  const short = tokenize(message).length <= 4;
  const refines = !!previous && (u.filters.connector || short || PRONOUN.test(` ${tokenize(message).join(" ")} `));

  // Réponse à « de quel projet parlez-vous ? » : si le message nomme un projet
  // du compte, l'intention en attente reprend — avant tout autre routage, car
  // un titre comme « Vidéo produit Nour » ressemble à une question d'offres.
  let pendingProject: ProjectDTO | null = null;
  if (previous?.pending) {
    const named = projectsNamed(message, await source.projects(ctx, { company, limit: 20 }), u.filters.name);
    if (named.length === 1) pendingProject = named[0]!;
  }

  if (pendingProject && previous?.pending) {
    intent = previous.pending;
  } else if (u.routed.kind === "match") {
    intent = u.routed.id as BuddyIntentId;
  } else if (previous?.pending && short) {
    intent = previous.pending;
  } else if (refines && previous && (u.filters.status || u.filters.since || u.filters.reference || u.filters.name || u.filters.ordinal || u.filters.limit || u.entity)) {
    intent = previous.intent;
    filter = { ...deserialize(previous.filter), ...filter };
  } else if (u.routed.kind === "ambiguous") {
    const labels = u.routed.ids.map((id) => t.intentLabel[id as BuddyIntentId] ?? id);
    return { kind: "refusal", lang, text: t.ambiguous(labels), suggestions: u.routed.ids.map((id) => t.intentQuestion[id as BuddyIntentId] ?? id), context: carry };
  } else {
    return fallback(t, message, u.partial.map((p) => p.id as BuddyIntentId), ctx.role, previous, lang);
  }

  if (filter.reference && intent !== "review") intent = "invoices";
  if (filter.name && intent === "summary") intent = "project";

  /* --- quel projet ? --- */
  let project: ProjectDTO | null = null;
  if (PROJECT_INTENTS.has(intent) || intent === "human") {
    const projects = await source.projects(ctx, { company, limit: 20 });
    if (projects.length === 0 && PROJECT_INTENTS.has(intent)) {
      return { kind: "refusal", lang, text: t.noProjects, actions: isAdmin ? undefined : [{ label: t.actions.newProject, href: "/client/nouveau-projet" }], context: { intent, lang } };
    }
    const named = pendingProject ? [pendingProject] : projectsNamed(message, projects, filter.name);
    const remembered = previous?.projectId ? projects.find((p) => p.id === previous.projectId) ?? null : null;
    if (named.length === 1) project = named[0]!;
    else if (named.length > 1) return clarify(t, intent, named, lang, previous);
    else if (remembered && (refines || previous?.pending || short)) project = remembered;
    else if (projects.length === 1) project = projects[0]!;
    else if (remembered && intent !== "project") project = remembered;
    else if (PROJECT_INTENTS.has(intent)) {
      // Plusieurs projets, aucun nommé. Une question de fichiers ou « mes
      // projets » (pluriel) porte sur tous ; « mon projet », une échéance,
      // une révision ou une validation visent un seul projet : on demande.
      const plural = /\b(projets|projects|tous|toutes|all|chaque|every)\b/.test(tokenize(message).join(" "));
      const needsOne = intent === "deadline" || intent === "revision" || intent === "approve" || (intent === "project" && !plural);
      if (needsOne) return clarify(t, intent, projects.filter((p) => p.status !== "CLOTURE").slice(0, 4), lang, previous);
      project = null;
    }
    if (project) filter = { ...filter, projectId: project.id, name: undefined };
  }

  const result = await render(t, intent, ctx, message, source, filter, u.filters.ordinal, project, now, suggestions);
  return { ...result, lang, context: { intent, filter: serialize(filter), projectId: project?.id ?? (PROJECT_INTENTS.has(intent) ? undefined : previous?.projectId), lang, fallbacks: 0 } };
}

function clarify(t: Strings, intent: BuddyIntentId, options: ProjectDTO[], lang: Lang, previous?: BuddyContext): BuddyResult {
  const titles = options.map((p) => p.title);
  return { kind: "answer", lang, text: t.clarifyProject(titles), suggestions: titles, context: { intent, pending: intent, lang, projectId: previous?.projectId, fallbacks: 0 } };
}

/** Repli utile : dire ce qui n'est pas compris, proposer des pistes proches — jamais deux fois la même. */
function fallback(t: Strings, message: string, partial: BuddyIntentId[], role: "ADMIN" | "CLIENT", previous: BuddyContext | undefined, lang: Lang): BuddyResult {
  const fallbacks = Math.min((previous?.fallbacks ?? 0) + 1, 5);
  const snippet = message.length > 60 ? `${message.slice(0, 60)}…` : message;
  const near = partial.map((id) => t.intentQuestion[id]).filter(Boolean);
  const suggestions = near.length ? near : t.suggestions(role).slice(0, 3);
  const human = role === "CLIENT" ? [{ label: t.actions.messages, href: "/client/messages" }] : undefined;
  return {
    kind: "refusal",
    lang,
    text: fallbacks === 1 ? t.notUnderstood(snippet, near.map((q) => q.replace(/[?？]$/, "").trim())) : t.notUnderstoodAgain,
    suggestions,
    actions: fallbacks >= 2 ? human : undefined,
    context: { intent: previous?.intent ?? "help", projectId: previous?.projectId, lang, fallbacks },
  };
}

/** L'élément désigné par « la 2ᵉ », « la dernière » — ou rien si hors liste. */
function pick<T>(items: T[], ordinal: number): T | undefined {
  if (ordinal === -1) return items.at(-1);
  return ordinal >= 1 ? items[ordinal - 1] : undefined;
}

async function render(
  t: Strings, id: BuddyIntentId, ctx: BuddyCtx, message: string, source: BuddyDataSource, filter: QueryFilter,
  ordinal: number | undefined, project: ProjectDTO | null, now: Date, suggestions: string[],
): Promise<Omit<BuddyResult, "context" | "lang">> {
  const showCompany = ctx.role === "ADMIN";
  const noItem = (count: number) => ({ kind: "refusal" as const, text: t.noSuchItem(ordinal ?? 0, count) });
  const wantsSteps = /\b(etape|etapes|steps?|detail|detaille)\b/.test(tokenize(message).join(" "));

  switch (id) {
    case "help":
      return { kind: "answer", text: paragraphs(t.help, suggestions.map((s) => `• ${s}`).join("\n")), suggestions };

    case "human":
      return { kind: "answer", ...renderHuman(t, ctx.role, project) };

    case "newProject":
      return { kind: "answer", ...renderNewProject(t, ctx.role) };

    case "profile": {
      const p = await source.profile(ctx);
      if (!p) return { kind: "answer", text: t.profileAdmin };
      return { kind: "answer", text: t.profileReply(p), actions: [{ label: t.actions.profile, href: "/client/profil" }] };
    }

    case "summary":
      return { kind: "answer", text: renderSummary(t, await source.summary(ctx)) };

    case "project": {
      if (project) return { kind: "answer", text: renderProjectStatus(t, project, now, wantsSteps), actions: statusActions(t, ctx.role, project) };
      const projects = await source.projects(ctx, filter);
      if (projects.length === 0) return { kind: "refusal", text: t.noEvidence };
      if (ordinal) {
        const one = pick(projects, ordinal);
        return one ? { kind: "answer", text: renderProjectStatus(t, one, now, true) } : noItem(projects.length);
      }
      return { kind: "answer", text: renderProjects(t, projects, showCompany, filter) };
    }

    case "deadline":
      return { kind: "answer", text: renderDeadline(t, project!, now) };

    case "deliverables":
    case "download": {
      const items = await source.deliverables(ctx, project ? { projectId: project.id } : filter);
      const r = id === "download" ? renderDownload(t, items, project?.title) : renderDeliverables(t, items, project?.title, !project);
      return { kind: "answer", text: r.text, actions: r.actions };
    }

    case "revision":
    case "approve": {
      const items = await source.deliverables(ctx, { projectId: project!.id });
      const r = id === "revision" ? renderRevision(t, awaitingDeliverable(items), project!.title) : renderApprove(t, awaitingDeliverable(items), project!.title);
      return { kind: "answer", ...r };
    }

    case "orders": {
      const orders = await source.orders(ctx, filter);
      if (orders.length === 0) return { kind: "refusal", text: t.noEvidence };
      if (ordinal) {
        const one = pick(orders, ordinal);
        return one ? { kind: one.review.length ? "review" : "answer", text: renderOrderDetail(t, one, showCompany), reviewCount: one.review.length } : noItem(orders.length);
      }
      const flagged = orders.filter((o) => o.review.length).map((o) => ({ ref: `${o.packName} (#${o.id})`, clientCompany: o.clientCompany, reasons: o.review }));
      return withReview(t, renderOrders(t, orders, showCompany, filter), flagged, showCompany);
    }

    case "products": {
      const products = await source.products();
      if (products.length === 0) return { kind: "refusal", text: t.noEvidence };
      const { text, actions } = answerOffers(t, message, products, ctx.role);
      return { kind: "answer", text, actions };
    }

    case "review": {
      const items = await source.reviewItems(ctx, filter);
      return { kind: items.length ? "review" : "answer", text: renderReview(t, items, showCompany), reviewCount: items.length };
    }

    case "threads": {
      // « qu'a envoyé l'équipe », « dernier message » : les messages de l'autre partie, pas la liste des fils.
      const asksTeam = /\b(equipe|team|envoye|sent|dernier|derniere|latest|last|recu|received)\b/.test(tokenize(message).join(" "));
      if (asksTeam || project) {
        const items = await source.teamMessages(ctx, { ...filter, projectId: project?.id, limit: /\b(dernier|latest|last)\b/.test(tokenize(message).join(" ")) ? 1 : 3 });
        const first = items[0];
        return { kind: "answer", text: renderTeamMessages(t, items, now), actions: first && ctx.role === "CLIENT" ? [{ label: t.actions.thread(first.projectTitle), href: `/client/messages/${first.projectId}` }] : undefined };
      }
      const threads = await source.threads(ctx, filter);
      if (threads.length === 0) return { kind: "refusal", text: t.noEvidence };
      if (ordinal) {
        const one = pick(threads, ordinal);
        return one ? { kind: "answer", text: renderThreadDetail(t, one, showCompany) } : noItem(threads.length);
      }
      return { kind: "answer", text: renderThreads(t, threads, showCompany, filter) };
    }

    case "tasks":
      return { kind: "answer", text: renderTasks(t, await source.tasks(ctx, filter), showCompany) };

    case "invoices": {
      // « Do I have an unpaid invoice? » : une réponse oui/non, pas une liste comptable.
      const asksUnpaid = /\b(impaye|impayee|impayes|unpaid|a payer|to pay|dois|owe|reste)\b/.test(tokenize(message).join(" ")) && !filter.reference && !ordinal;
      if (asksUnpaid) {
        // « impayée » a posé un statut « en attente » : ici on veut aussi les factures en retard.
        const all = await source.invoices(ctx, { ...filter, status: undefined });
        const unpaid = all.filter((i) => i.status === "EN_ATTENTE" || i.status === "EN_RETARD");
        return unpaid.length
          ? { kind: "answer", text: t.unpaidReply(unpaid), actions: ctx.role === "CLIENT" ? [{ label: t.actions.invoices, href: "/client/factures" }] : undefined }
          : { kind: "answer", text: t.noUnpaid };
      }
      const invoices = await source.invoices(ctx, filter);
      if (invoices.length === 0) return { kind: "refusal", text: t.noEvidence };
      if (filter.reference || ordinal) {
        const one = ordinal ? pick(invoices, ordinal) : invoices[0];
        if (!one) return noItem(invoices.length);
        return { kind: one.review.length ? "review" : "answer", text: renderInvoiceDetail(t, one, showCompany), reviewCount: one.review.length };
      }
      const flagged = invoices.filter((i) => i.review.length).map((i) => ({ ref: i.number, clientCompany: i.clientCompany, reasons: i.review }));
      return withReview(t, renderInvoices(t, invoices, showCompany, filter), flagged, showCompany);
    }
  }
}

function statusActions(t: Strings, role: "ADMIN" | "CLIENT", p: ProjectDTO): Action[] | undefined {
  if (role !== "CLIENT") return undefined;
  return p.status === "EN_REVISION" ? [{ label: t.actions.home, href: "/client" }] : [{ label: t.actions.thread(p.title), href: `/client/messages/${p.id}` }];
}

function withReview(t: Strings, text: string, flagged: { ref: string; clientCompany?: string; reasons: string[] }[], showCompany: boolean): Omit<BuddyResult, "context" | "lang"> {
  if (flagged.length === 0) return { kind: "answer", text };
  return { kind: "review", text: paragraphs(text, reviewFooter(t, flagged, showCompany)), reviewCount: flagged.length };
}
