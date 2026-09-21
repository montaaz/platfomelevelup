import { route } from "./core/router";
import { extractEntity } from "./entity";
import { INTENTS, SUGGESTIONS, type BuddyIntentId } from "./intents";
import {
  INTENT_LABELS, REFUSALS, renderInvoices, renderOrders, renderProducts, renderReview,
  renderSummary, renderTasks, renderThreads, reviewFooter,
} from "./templates";
import { paragraphs } from "./core/templates";
import type { BuddyCtx, BuddyDataSource, EntityFilter } from "./data/types";
import { tokenize, termMatches } from "./core/normalize";

/**
 * Orchestrateur du Dashboard Buddy.
 *
 * Message + session → entité visée → intention → permission → lecture →
 * gabarit. À chaque étape, un refus explicite plutôt qu'une supposition :
 * question inconnue, question ambiguë, entité interdite, aucune donnée. Et
 * quand les données sont incomplètes, la réponse le dit au lieu de les
 * présenter comme fiables.
 */

export type BuddyResult = {
  kind: "answer" | "refusal" | "review";
  text: string;
  suggestions?: string[];
  /** Nombre d'enregistrements signalés pour vérification manuelle. */
  reviewCount?: number;
};

const MAX_CHARS = 1500;

export async function answerBuddy(ctx: BuddyCtx, rawMessage: string, source: BuddyDataSource): Promise<BuddyResult> {
  const message = (rawMessage ?? "").slice(0, MAX_CHARS);
  const suggestions = SUGGESTIONS[ctx.role];
  const isAdmin = ctx.role === "ADMIN";

  // Permission d'abord : un client qui vise une autre entité que lui-même est
  // refusé avant toute autre analyse, quelle que soit la question posée.
  const entity = extractEntity(message);
  if (!isAdmin && entity) {
    return { kind: "refusal", text: REFUSALS.unauthorized };
  }
  const filter: EntityFilter | undefined = isAdmin && entity?.kind === "named" ? { company: entity.name } : undefined;

  const result = route(message, INTENTS);
  if (result.kind === "none") {
    return { kind: "refusal", text: REFUSALS.unsupported(suggestions), suggestions };
  }
  if (result.kind === "ambiguous") {
    const labels = result.ids.map((id) => INTENT_LABELS[id] ?? id);
    return { kind: "refusal", text: REFUSALS.ambiguous(labels), suggestions: labels };
  }

  return render(result.id, ctx, message, source, filter, suggestions);
}

async function render(
  id: BuddyIntentId,
  ctx: BuddyCtx,
  message: string,
  source: BuddyDataSource,
  filter: EntityFilter | undefined,
  suggestions: string[],
): Promise<BuddyResult> {
  const showCompany = ctx.role === "ADMIN";

  switch (id) {
    case "help":
      return { kind: "answer", text: REFUSALS.help(suggestions), suggestions };

    case "summary":
      return { kind: "answer", text: renderSummary(await source.summary(ctx)) };

    case "orders": {
      const orders = await source.orders(ctx, filter);
      if (orders.length === 0) return { kind: "refusal", text: REFUSALS.noEvidence };
      const flagged = orders.filter((o) => o.review.length > 0).map((o) => ({ ref: `${o.packName} (#${o.id})`, clientCompany: o.clientCompany, reasons: o.review }));
      return withReview(renderOrders(orders, showCompany), flagged, showCompany);
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
      return { kind: "answer", text: renderThreads(threads, showCompany) };
    }

    case "tasks":
      return { kind: "answer", text: renderTasks(await source.tasks(ctx, filter), showCompany) };

    case "invoices": {
      const invoices = await source.invoices(ctx, filter);
      if (invoices.length === 0) return { kind: "refusal", text: REFUSALS.noEvidence };
      const flagged = invoices.filter((i) => i.review.length > 0).map((i) => ({ ref: i.number, clientCompany: i.clientCompany, reasons: i.review }));
      return withReview(renderInvoices(invoices, showCompany), flagged, showCompany);
    }
  }
}

/** Ajoute le pied « à vérifier » quand des enregistrements sont incomplets. */
function withReview(text: string, flagged: { ref: string; clientCompany?: string; reasons: string[] }[], showCompany: boolean): BuddyResult {
  if (flagged.length === 0) return { kind: "answer", text };
  return { kind: "review", text: paragraphs(text, reviewFooter(flagged, showCompany)), reviewCount: flagged.length };
}
