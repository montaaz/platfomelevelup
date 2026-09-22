import { formatDT, formatDateFull, relativeTime, PROJECT_STATUS_LABEL, INVOICE_STATUS_LABEL } from "@/lib/format";
import { bullets, paragraphs, plural, truncate } from "./core/templates";
import type {
  InvoiceDTO, OrderDTO, ProductDTO, ProjectDTO, QueryFilter, ReviewItemDTO, SummaryDTO, TaskDTO, ThreadDTO,
} from "./data/types";

/**
 * Gabarits de réponse du Dashboard Buddy.
 *
 * Chaque fonction reçoit des données déjà lues et cloisonnées, et les met en
 * phrases fixes. Aucun texte n'est composé librement : ce qui n'est pas dans
 * les données n'apparaît pas dans la réponse.
 */

const ORDER_STATUS: Record<string, string> = {
  EN_ATTENTE_PAIEMENT: "en attente de paiement",
  PAYEE: "payée",
  ANNULEE: "annulée",
};

const PAYMENT_METHOD: Record<string, string> = {
  VIREMENT: "virement", CARTE: "carte", ESPECES: "espèces", CHEQUE: "chèque", EN_LIGNE: "en ligne",
};

const STATUS_WORD: Record<string, string> = {
  PAYEE: "payées", EN_ATTENTE: "en attente", EN_RETARD: "en retard", ANNULEE: "annulées",
  EN_COURS: "en cours", EN_REVISION: "en révision", LIVRE: "livrés", CLOTURE: "clôturés",
};

export const REFUSALS = {
  unsupported: (suggestions: string[]) =>
    paragraphs(
      "Je ne réponds qu'aux questions sur votre espace : projets, commandes, factures, messages et tâches. Voici ce que vous pouvez me demander :",
      bullets(suggestions),
    ),
  ambiguous: (options: string[]) => `Vouliez-vous dire : ${options.join(" ou ")} ? Précisez et je vous réponds.`,
  unauthorized: "Vous ne pouvez consulter que les données de votre propre compte.",
  noEvidence: "Aucune donnée ne correspond pour l'instant.",
  noSuchItem: (n: number, count: number) =>
    `Il n'y a pas de ${n}ᵉ élément : la liste précédente en compte ${count}.`,
  help: (suggestions: string[]) => paragraphs("Voici ce que vous pouvez me demander :", bullets(suggestions)),
} as const;

export const SMALLTALK = {
  greeting: (firstName: string, suggestions: string[]) =>
    paragraphs(`Bonjour ${firstName} ! Que voulez-vous savoir sur votre espace ?`, bullets(suggestions)),
  thanks: "Avec plaisir. Autre chose ?",
  bye: "À bientôt ! Je reste ici si vous avez une question.",
} as const;

export const INTENT_LABELS: Record<string, string> = {
  summary: "Résumé",
  orders: "Commandes",
  products: "Offres",
  review: "À vérifier",
  threads: "Conversations",
  tasks: "Tâches",
  invoices: "Facturation",
  project: "Projets",
  help: "Aide",
};

/** « payées de ce mois », « en retard »… : ce que la question a précisé. */
export function filterSuffix(filter?: QueryFilter): string {
  if (!filter) return "";
  const parts: string[] = [];
  if (filter.status && STATUS_WORD[filter.status]) parts.push(STATUS_WORD[filter.status]!);
  if (filter.label) parts.push(filter.label);
  if (filter.company) parts.push(`de ${filter.company}`);
  return parts.length ? ` ${parts.join(" ")}` : "";
}

/** Pied de réponse quand des enregistrements sont incomplets. */
export function reviewFooter(items: { ref: string; clientCompany?: string; reasons: string[] }[], showCompany: boolean): string {
  if (items.length === 0) return "";
  return paragraphs(
    `⚠ ${plural(items.length, "enregistrement à vérifier manuellement", "enregistrements à vérifier manuellement")} :`,
    bullets(items.map((i) => `${i.ref}${showCompany && i.clientCompany ? ` — ${i.clientCompany}` : ""} : ${i.reasons.join(", ")}`)),
  );
}

export function renderSummary(s: SummaryDTO): string {
  if (s.role === "CLIENT") {
    const projects = s.activeProjects.length === 0
      ? "Aucun projet en cours."
      : bullets(s.activeProjects.map((p) =>
          `${p.title} — ${PROJECT_STATUS_LABEL[p.status] ?? p.status}, ${p.progress} %${p.nextStep ? ` · prochaine étape : ${p.nextStep}` : ""}`,
        ));
    return paragraphs(
      `Vous avez ${plural(s.activeProjects.length, "projet actif", "projets actifs")}.`,
      projects,
      s.unpaidCount > 0 ? `${plural(s.unpaidCount, "facture à régler", "factures à régler")} : ${formatDT(s.unpaidTotal)}.` : "Aucune facture en attente.",
      s.pendingOrders > 0 ? `${plural(s.pendingOrders, "commande en attente de paiement", "commandes en attente de paiement")}.` : null,
      s.unread > 0 ? `${plural(s.unread, "message non lu", "messages non lus")}.` : null,
    );
  }
  return paragraphs(
    "Situation de l'agence :",
    bullets([
      `Chiffre d'affaires du mois : ${formatDT(s.revenueMonth)}`,
      `${plural(s.projectsInProgress, "projet en cours", "projets en cours")}`,
      `${plural(s.unpaidCount, "facture impayée", "factures impayées")} : ${formatDT(s.unpaidTotal)}`,
      `${plural(s.revisionRequests, "demande de révision", "demandes de révision")}`,
      `${plural(s.pendingOrders, "commande à encaisser", "commandes à encaisser")}`,
      `${plural(s.newRequests, "nouvelle demande de projet", "nouvelles demandes de projet")}`,
    ]),
  );
}

export function renderOrders(orders: OrderDTO[], showCompany: boolean, filter?: QueryFilter): string {
  return paragraphs(
    `${plural(orders.length, "commande", "commandes")}${filterSuffix(filter)} :`,
    bullets(orders.map((o, i) =>
      `${i + 1}. ${o.packName}${showCompany ? ` — ${o.clientCompany}` : ""} · ${formatDT(o.amount)} · ${ORDER_STATUS[o.status] ?? o.status} · ${formatDateFull(o.createdAt)}`,
    )),
  );
}

export function renderOrderDetail(o: OrderDTO, showCompany: boolean): string {
  return paragraphs(
    `Commande #${o.id} — ${o.packName}${showCompany ? ` (${o.clientCompany})` : ""}`,
    bullets([
      `Montant : ${formatDT(o.amount)}`,
      `Statut : ${ORDER_STATUS[o.status] ?? o.status}`,
      `Passée le ${formatDateFull(o.createdAt)}`,
      o.paidAt ? `Payée le ${formatDateFull(o.paidAt)}${o.paymentMethod ? ` par ${PAYMENT_METHOD[o.paymentMethod] ?? o.paymentMethod}` : ""}` : "Paiement non enregistré",
    ]),
    o.review.length ? `⚠ À vérifier : ${o.review.join(", ")}` : null,
  );
}

export function renderProducts(products: ProductDTO[], mentionsStock: boolean): string {
  return paragraphs(
    mentionsStock ? "Nous ne gérons pas de stock : nos offres sont des prestations. Les voici :" : "Nos offres :",
    bullets(products.map((p) =>
      `${p.name} · ${formatDT(p.price)}${p.isMonthly ? " / mois" : ""}${p.description ? ` — ${truncate(p.description, 90)}` : ""}`,
    )),
  );
}

export function renderReview(items: ReviewItemDTO[], showCompany: boolean): string {
  if (items.length === 0) return "Rien à vérifier : tous les enregistrements consultés sont complets.";
  return reviewFooter(items, showCompany);
}

export function renderThreads(threads: ThreadDTO[], showCompany: boolean, filter?: QueryFilter): string {
  return paragraphs(
    `${plural(threads.length, "conversation récente", "conversations récentes")}${filterSuffix(filter)} :`,
    bullets(threads.map((t, i) =>
      `${i + 1}. ${t.projectTitle}${showCompany ? ` — ${t.clientCompany}` : ""} · ${t.lastSenderName.split(" ")[0]} : « ${truncate(t.lastMessage, 80)} » · ${relativeTime(t.lastAt)}${t.unread > 0 ? ` · ${plural(t.unread, "non lu", "non lus")}` : ""}`,
    )),
  );
}

export function renderThreadDetail(t: ThreadDTO, showCompany: boolean): string {
  return paragraphs(
    `${t.projectTitle}${showCompany ? ` — ${t.clientCompany}` : ""}`,
    `Dernier message, ${relativeTime(t.lastAt)}, de ${t.lastSenderName} :\n« ${t.lastMessage} »`,
    t.unread > 0 ? `${plural(t.unread, "message non lu", "messages non lus")} dans ce fil.` : null,
  );
}

export function renderTasks(tasks: TaskDTO[], showCompany: boolean): string {
  if (tasks.length === 0) return "Rien en attente de votre part pour le moment.";
  return paragraphs(
    `${plural(tasks.length, "tâche en attente", "tâches en attente")} :`,
    bullets(tasks.map((t, i) => `${i + 1}. ${t.label}${showCompany ? ` — ${t.clientCompany}` : ""}`)),
  );
}

export function renderInvoices(invoices: InvoiceDTO[], showCompany: boolean, filter?: QueryFilter): string {
  const unpaid = invoices.filter((i) => i.status === "EN_ATTENTE" || i.status === "EN_RETARD");
  const unpaidTotal = unpaid.reduce((s, i) => s + i.total, 0);
  const paidTotal = invoices.filter((i) => i.status === "PAYEE").reduce((s, i) => s + i.total, 0);
  return paragraphs(
    `${plural(invoices.length, "facture", "factures")}${filterSuffix(filter)} — payé : ${formatDT(paidTotal)}, reste à régler : ${formatDT(unpaidTotal)}.`,
    bullets(invoices.map((i, n) =>
      `${n + 1}. ${i.number}${showCompany ? ` — ${i.clientCompany}` : ""} · ${formatDT(i.total)} · ${INVOICE_STATUS_LABEL[i.status] ?? i.status}${i.dueDate ? ` · échéance ${formatDateFull(i.dueDate)}` : ""}`,
    )),
  );
}

export function renderInvoiceDetail(i: InvoiceDTO, showCompany: boolean): string {
  return paragraphs(
    `Facture ${i.number}${showCompany ? ` — ${i.clientCompany}` : ""}`,
    bullets([
      `Montant : ${formatDT(i.total)}`,
      `Statut : ${INVOICE_STATUS_LABEL[i.status] ?? i.status}`,
      `Émise le ${formatDateFull(i.issueDate)}`,
      i.dueDate ? `Échéance le ${formatDateFull(i.dueDate)}` : null,
      i.paidAt ? `Payée le ${formatDateFull(i.paidAt)}` : null,
      i.projectTitle ? `Projet : ${i.projectTitle}` : null,
    ].filter((l): l is string => !!l)),
    i.review.length ? `⚠ À vérifier : ${i.review.join(", ")}` : null,
  );
}

export function renderProjects(projects: ProjectDTO[], showCompany: boolean, filter?: QueryFilter): string {
  return paragraphs(
    `${plural(projects.length, "projet", "projets")}${filterSuffix(filter)} :`,
    bullets(projects.map((p, i) =>
      `${i + 1}. ${p.title}${showCompany ? ` — ${p.clientCompany}` : ""} · ${PROJECT_STATUS_LABEL[p.status] ?? p.status} · ${p.progress} %${p.nextStep ? ` · prochaine étape : ${p.nextStep}` : ""}`,
    )),
    "Demandez « où en est le projet … » pour le détail des étapes.",
  );
}

export function renderProjectDetail(p: ProjectDTO, showCompany: boolean): string {
  return paragraphs(
    `${p.title}${showCompany ? ` — ${p.clientCompany}` : ""}${p.serviceName ? ` · ${p.serviceName}` : ""}`,
    `${PROJECT_STATUS_LABEL[p.status] ?? p.status}, ${p.progress} % d'avancement${p.dueDate ? ` · échéance ${formatDateFull(p.dueDate)}` : ""}.`,
    bullets(p.steps.map((s) => `${s.reachedAt ? "✓" : "○"} ${s.label}${s.reachedAt ? ` — ${formatDateFull(s.reachedAt)}` : ""}`)),
    p.nextStep ? `Prochaine étape : ${p.nextStep}.` : "Toutes les étapes sont franchies.",
  );
}
