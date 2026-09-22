import { bullets, paragraphs } from "./core/templates";
import type { Strings } from "./locales";
import type {
  DeliverableDTO, InvoiceDTO, OrderDTO, ProjectDTO, QueryFilter, ReviewItemDTO, SummaryDTO, TaskDTO, TeamMessageDTO, ThreadDTO,
} from "./data/types";

/**
 * Gabarits de réponse du Dashboard Buddy.
 *
 * Chaque fonction reçoit des données déjà lues et cloisonnées, et les met en
 * phrases fixes dans la langue demandée. Aucun texte n'est composé
 * librement : ce qui n'est pas dans les données n'apparaît pas.
 */

export type Action = { label: string; href: string };

/** « payées de ce mois », « en retard »… : ce que la question a précisé. */
export function filterSuffix(t: Strings, filter?: QueryFilter): string {
  if (!filter) return "";
  const parts: string[] = [];
  if (filter.status && t.filterStatus[filter.status]) parts.push(t.filterStatus[filter.status]!);
  if (filter.label) parts.push(t.period(filter.label));
  if (filter.company) parts.push(`${t.lang === "fr" ? "de" : "of"} ${filter.company}`);
  return parts.length ? ` ${parts.join(" ")}` : "";
}

/** Pied de réponse quand des enregistrements sont incomplets. */
export function reviewFooter(t: Strings, items: { ref: string; clientCompany?: string; reasons: string[] }[], showCompany: boolean): string {
  if (items.length === 0) return "";
  return paragraphs(
    t.reviewHeading(items.length),
    bullets(items.map((i) => `${i.ref}${showCompany && i.clientCompany ? ` — ${i.clientCompany}` : ""} : ${i.reasons.join(", ")}`)),
  );
}

export const renderSummary = (t: Strings, s: SummaryDTO) => (s.role === "CLIENT" ? t.summaryClient(s) : t.summaryAdmin(s));

export const renderOrders = (t: Strings, orders: OrderDTO[], showCompany: boolean, filter?: QueryFilter) =>
  paragraphs(
    t.ordersHeading(orders.length, filterSuffix(t, filter)),
    bullets(orders.map((o, i) => `${i + 1}. ${o.packName}${showCompany ? ` — ${o.clientCompany}` : ""} · ${t.money(o.amount)} · ${t.orderStatus[o.status] ?? o.status} · ${t.date(o.createdAt)}`)),
  );

export const renderOrderDetail = (t: Strings, o: OrderDTO, showCompany: boolean) => t.orderDetail(o, showCompany);

export const renderReview = (t: Strings, items: ReviewItemDTO[], showCompany: boolean) =>
  items.length === 0 ? t.reviewNone : reviewFooter(t, items, showCompany);

export const renderThreads = (t: Strings, threads: ThreadDTO[], showCompany: boolean, filter?: QueryFilter) =>
  paragraphs(
    t.threadsHeading(threads.length, filterSuffix(t, filter)),
    bullets(threads.map((th, i) => `${i + 1}. ${t.threadLine({ ...th, lastMessage: th.lastMessage.length > 80 ? `${th.lastMessage.slice(0, 80)}…` : th.lastMessage }, showCompany)}`)),
  );

export const renderThreadDetail = (t: Strings, th: ThreadDTO, showCompany: boolean) => t.threadDetail(th, showCompany);

export const renderTeamMessages = (t: Strings, items: TeamMessageDTO[], now: Date) =>
  items.length === 0 ? t.noTeamMessages : t.teamMessagesReply(items, now);

export const renderTasks = (t: Strings, tasks: TaskDTO[], showCompany: boolean) =>
  t.tasksReply(tasks.map((x, i) => ({ ...x, label: `${i + 1}. ${x.label}` })), showCompany);

export function renderInvoices(t: Strings, invoices: InvoiceDTO[], showCompany: boolean, filter?: QueryFilter): string {
  const unpaid = invoices.filter((i) => i.status === "EN_ATTENTE" || i.status === "EN_RETARD");
  const unpaidTotal = unpaid.reduce((s, i) => s + i.total, 0);
  const paidTotal = invoices.filter((i) => i.status === "PAYEE").reduce((s, i) => s + i.total, 0);
  return paragraphs(
    t.invoicesHeading(invoices.length, filterSuffix(t, filter), paidTotal, unpaidTotal),
    bullets(invoices.map((i, k) => `${k + 1}. ${t.invoiceLine(i, showCompany)}`)),
  );
}

export const renderInvoiceDetail = (t: Strings, i: InvoiceDTO, showCompany: boolean) => t.invoiceDetail(i, showCompany);

export const renderProjects = (t: Strings, projects: ProjectDTO[], showCompany: boolean, filter?: QueryFilter) =>
  paragraphs(
    t.projectsHeading(projects.length, filterSuffix(t, filter)),
    bullets(projects.map((p, i) => `${i + 1}. ${t.projectLine(p)}${showCompany ? ` — ${p.clientCompany}` : ""}`)),
    t.projectsHint,
  );

export const renderProjectStatus = (t: Strings, p: ProjectDTO, now: Date, detailed: boolean) =>
  detailed ? t.stepsReply(p) : t.projectStatusReply(p, now);

export const renderDeadline = (t: Strings, p: ProjectDTO, now: Date) => t.deadlineReply(p, now);

export function renderDeliverables(t: Strings, items: DeliverableDTO[], projectTitle: string | undefined, showProject: boolean): { text: string; actions: Action[] } {
  if (items.length === 0) return { text: t.noDeliverables(projectTitle), actions: [] };
  return {
    text: t.deliverablesReply(items, showProject),
    actions: items.slice(0, 4).map((d) => ({ label: t.actions.download(d.name), href: d.href })),
  };
}

export function renderDownload(t: Strings, items: DeliverableDTO[], projectTitle: string | undefined): { text: string; actions: Action[] } {
  if (items.length === 0) return { text: t.noDeliverables(projectTitle), actions: [] };
  return {
    text: t.downloadReply(items.length),
    actions: items.slice(0, 6).map((d) => ({ label: t.actions.download(d.name), href: d.href })),
  };
}

/** Le livrable qui attend le client sur ce projet, s'il y en a un. */
export const awaitingDeliverable = (items: DeliverableDTO[]) => items.find((d) => d.approval === "EN_ATTENTE") ?? null;

export const renderRevision = (t: Strings, d: DeliverableDTO | null, projectTitle: string) => ({
  text: t.revisionReply(d, projectTitle),
  actions: d ? [{ label: t.actions.home, href: "/client" }] : [{ label: t.actions.messages, href: "/client/messages" }],
});

export const renderApprove = (t: Strings, d: DeliverableDTO | null, projectTitle: string) => ({
  text: t.approveReply(d, projectTitle),
  actions: d ? [{ label: t.actions.home, href: "/client" }] : [{ label: t.actions.messages, href: "/client/messages" }],
});

export function renderHuman(t: Strings, role: "ADMIN" | "CLIENT", project: ProjectDTO | null): { text: string; actions: Action[] } {
  if (role === "ADMIN") return { text: t.humanAdmin, actions: [{ label: t.intentLabel.threads, href: "/admin/messagerie" }] };
  return {
    text: t.humanReply(project?.title ?? null),
    actions: [project ? { label: t.actions.thread(project.title), href: `/client/messages/${project.id}` } : { label: t.actions.messages, href: "/client/messages" }],
  };
}

export const renderNewProject = (t: Strings, role: "ADMIN" | "CLIENT") =>
  role === "CLIENT"
    ? { text: t.newProjectClient, actions: [{ label: t.actions.newProject, href: "/client/nouveau-projet" }] }
    : { text: t.newProjectAdmin, actions: [{ label: t.actions.adminProjects, href: "/admin/projets" }] };
