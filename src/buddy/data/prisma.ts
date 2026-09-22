import { prisma } from "@/lib/prisma";
import { assertAdmin, clientScope } from "@/server/context";
import { adminDashboard, clientHome } from "@/server/services/dashboard";
import { listThreads } from "@/server/services/messaging";
import { reviewInvoice, reviewOrder } from "./review";
import { dateRange, invoiceStatus, orderStatus, projectStatus } from "./status";
import type {
  BuddyCtx, BuddyDataSource, DeliverableDTO, InvoiceDTO, OrderDTO, ProductDTO, ProfileDTO, ProjectDTO,
  QueryFilter, ReviewItemDTO, SummaryDTO, TaskDTO, TeamMessageDTO, ThreadDTO,
} from "./types";

/**
 * Adaptateur sur la base réelle.
 *
 * Aucune requête n'est composée depuis le message : chaque méthode est une
 * requête fixe dont les paramètres variables — `clientId` de la session,
 * statut d'une liste fermée, dates calculées, nom ou référence bornés — sont
 * tous liés comme paramètres. Le cloisonnement passe par les mêmes gardes
 * que le reste de l'application (`clientScope`, `assertAdmin`).
 */

const UNPAID = ["EN_ATTENTE", "EN_RETARD"] as const;
const LIMIT = 10;

/** Clause de portée : le client sur lui-même, l'admin sur tout ou un nom. */
function scope(ctx: BuddyCtx, filter?: QueryFilter) {
  if (ctx.role === "CLIENT") return { clientId: clientScope(ctx) };
  assertAdmin(ctx);
  return filter?.company
    ? { client: { companyName: { contains: filter.company, mode: "insensitive" as const } } }
    : {};
}

const take = (filter?: QueryFilter) => Math.min(filter?.limit ?? LIMIT, 50);
const matchesCompany = (company: string, filter?: QueryFilter) =>
  !filter?.company || company.toLowerCase().includes(filter.company.toLowerCase());

const progressOf = (steps: { reachedAt: Date | null }[]) =>
  steps.length === 0 ? 0 : Math.round((steps.filter((s) => s.reachedAt).length / steps.length) * 100);

export const prismaDataSource: BuddyDataSource = {
  async summary(ctx): Promise<SummaryDTO> {
    if (ctx.role === "CLIENT") {
      const clientId = clientScope(ctx);
      const [home, unpaid, pendingOrders] = await Promise.all([
        clientHome(ctx),
        prisma.invoice.aggregate({ _count: true, _sum: { total: true }, where: { clientId, status: { in: [...UNPAID] } } }),
        prisma.order.count({ where: { clientId, status: "EN_ATTENTE_PAIEMENT" } }),
      ]);
      const projects = [home.featured, ...home.others].filter((p): p is NonNullable<typeof p> => !!p);
      return {
        role: "CLIENT",
        activeProjects: projects.map((p) => ({
          title: p.title,
          status: p.status,
          nextStep: p.steps.find((s) => !s.reachedAt)?.label ?? null,
          progress: p.progress,
        })),
        unpaidCount: unpaid._count,
        unpaidTotal: Number(unpaid._sum.total ?? 0),
        unread: home.unreadCount,
        pendingOrders,
      };
    }
    const [dash, pendingOrders, newRequests] = await Promise.all([
      adminDashboard(ctx, 30, null),
      prisma.order.count({ where: { status: "EN_ATTENTE_PAIEMENT" } }),
      prisma.projectRequest.count({ where: { status: "NOUVELLE" } }),
    ]);
    return { role: "ADMIN", ...dash.kpis, pendingOrders, newRequests };
  },

  async orders(ctx, filter): Promise<OrderDTO[]> {
    const now = new Date();
    const status = orderStatus(filter?.status);
    const rows = await prisma.order.findMany({
      where: {
        ...scope(ctx, filter),
        ...(status ? { status } : {}),
        ...(dateRange(filter?.since, filter?.until) ? { createdAt: dateRange(filter?.since, filter?.until) } : {}),
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: take(filter),
      include: { client: true, pack: true },
    });
    return rows.map((o) => ({
      id: o.id.toString(),
      clientCompany: o.client.companyName,
      packName: o.pack.name,
      amount: Number(o.amount),
      status: o.status,
      createdAt: o.createdAt.toISOString(),
      paidAt: o.paidAt?.toISOString() ?? null,
      paymentMethod: o.paymentMethod,
      review: reviewOrder(
        {
          status: o.status,
          createdAt: o.createdAt,
          isMonthly: o.pack.isMonthly,
          projectId: o.projectId?.toString() ?? null,
          invoiceId: o.invoiceId?.toString() ?? null,
          paymentMethod: o.paymentMethod,
          paymentReference: o.paymentReference,
        },
        now,
      ),
    }));
  },

  async products(): Promise<ProductDTO[]> {
    const packs = await prisma.pack.findMany({ where: { isActive: true }, orderBy: { position: "asc" } });
    return packs.map((p) => ({
      code: p.code,
      name: p.name,
      description: p.description,
      includes: p.includes,
      tagline: p.tagline,
      price: Number(p.price),
      isMonthly: p.isMonthly,
      position: p.position,
    }));
  },

  async reviewItems(ctx, filter): Promise<ReviewItemDTO[]> {
    // Seul le client visé compte ici : un statut ou une période dans la
    // question ne doivent pas cacher un enregistrement incomplet.
    const only: QueryFilter = { company: filter?.company };
    const [invoices, orders] = await Promise.all([this.invoices(ctx, only), this.orders(ctx, only)]);
    const items: ReviewItemDTO[] = [];
    for (const i of invoices) {
      if (i.review.length) items.push({ kind: "FACTURE", ref: i.number, clientCompany: i.clientCompany, reasons: i.review });
    }
    for (const o of orders) {
      if (o.review.length) items.push({ kind: "COMMANDE", ref: `${o.packName} (#${o.id})`, clientCompany: o.clientCompany, reasons: o.review });
    }
    return items.slice(0, LIMIT);
  },

  async threads(ctx, filter): Promise<ThreadDTO[]> {
    const threads = await listThreads(ctx);
    return threads
      .filter((t) => matchesCompany(t.clientCompany, filter))
      .filter((t) => !filter?.since || new Date(t.lastAt) >= filter.since)
      .slice(0, filter?.limit ?? 5)
      .map((t) => ({
        projectId: t.projectId,
        projectTitle: t.projectTitle,
        clientCompany: t.clientCompany,
        lastMessage: t.lastMessage,
        lastSenderName: t.lastSenderName,
        unread: t.unread,
        lastAt: t.lastAt,
      }));
  },

  async tasks(ctx, filter): Promise<TaskDTO[]> {
    const tasks: TaskDTO[] = [];
    if (ctx.role === "CLIENT") {
      const clientId = clientScope(ctx);
      const [files, invoices, revisions, orders, client] = await Promise.all([
        prisma.file.findMany({
          where: { kind: "LIVRABLE", approval: "EN_ATTENTE", deletedAt: null, project: { clientId, deletedAt: null } },
          include: { project: true }, take: LIMIT,
        }),
        prisma.invoice.findMany({ where: { clientId, status: { in: [...UNPAID] } }, take: LIMIT }),
        prisma.project.findMany({ where: { clientId, status: "EN_REVISION", deletedAt: null }, take: LIMIT }),
        prisma.order.findMany({ where: { clientId, status: "EN_ATTENTE_PAIEMENT" }, include: { pack: true }, take: LIMIT }),
        prisma.client.findUnique({ where: { id: clientId }, select: { companyName: true, address: true, country: true } }),
      ]);
      const company = client?.companyName ?? "";
      for (const f of files) tasks.push({ label: `Livrable à approuver : ${f.originalName} (${f.project.title})`, clientCompany: company });
      for (const i of invoices) tasks.push({ label: `Facture ${i.invoiceNumber} à régler (${Number(i.total)} DT)`, clientCompany: company });
      for (const p of revisions) tasks.push({ label: `Projet « ${p.title} » attend votre validation`, clientCompany: company });
      for (const o of orders) tasks.push({ label: `Commande ${o.pack.name} en attente de paiement`, clientCompany: company });
      if (client && !(client.address?.trim() && client.country?.trim())) {
        tasks.push({ label: "Compléter votre profil (adresse et pays)", clientCompany: company });
      }
      return tasks;
    }

    const where = scope(ctx, filter);
    const [requests, orders, revisions, overdue] = await Promise.all([
      prisma.projectRequest.findMany({ where: { ...where, status: "NOUVELLE" }, include: { client: true }, take: LIMIT }),
      prisma.order.findMany({ where: { ...where, status: "EN_ATTENTE_PAIEMENT" }, include: { client: true, pack: true }, take: LIMIT }),
      prisma.project.findMany({ where: { ...where, status: "EN_REVISION", deletedAt: null }, include: { client: true }, take: LIMIT }),
      prisma.invoice.findMany({ where: { ...where, status: "EN_RETARD" }, include: { client: true }, take: LIMIT }),
    ]);
    for (const r of requests) tasks.push({ label: `Demande de projet à étudier : ${r.title}`, clientCompany: r.client.companyName });
    for (const o of orders) tasks.push({ label: `Commande à confirmer : ${o.pack.name} (${Number(o.amount)} DT)`, clientCompany: o.client.companyName });
    for (const p of revisions) tasks.push({ label: `Projet en révision : ${p.title}`, clientCompany: p.client.companyName });
    for (const i of overdue) tasks.push({ label: `Facture en retard : ${i.invoiceNumber} (${Number(i.total)} DT)`, clientCompany: i.client.companyName });
    return tasks;
  },

  async invoices(ctx, filter): Promise<InvoiceDTO[]> {
    const now = new Date();
    const status = invoiceStatus(filter?.status);
    const rows = await prisma.invoice.findMany({
      where: {
        ...scope(ctx, filter),
        status: status ?? { not: "BROUILLON" },
        ...(filter?.reference ? { invoiceNumber: { equals: filter.reference, mode: "insensitive" } } : {}),
        ...(dateRange(filter?.since, filter?.until) ? { issueDate: dateRange(filter?.since, filter?.until) } : {}),
      },
      orderBy: { issueDate: "desc" },
      take: take(filter),
      include: { client: true, project: true, payments: true, _count: { select: { lines: true } } },
    });
    return rows.map((i) => ({
      number: i.invoiceNumber,
      clientCompany: i.client.companyName,
      projectTitle: i.project?.title ?? null,
      status: i.status,
      total: Number(i.total),
      issueDate: i.issueDate.toISOString(),
      dueDate: i.dueDate?.toISOString() ?? null,
      paidAt: i.paidAt?.toISOString() ?? null,
      review: reviewInvoice({ status: i.status, dueDate: i.dueDate, lineCount: i._count.lines, payments: i.payments }, now),
    }));
  },

  async projects(ctx, filter): Promise<ProjectDTO[]> {
    const status = projectStatus(filter?.status);
    const rows = await prisma.project.findMany({
      where: {
        ...scope(ctx, filter),
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(filter?.name ? { title: { contains: filter.name, mode: "insensitive" } } : {}),
        ...(filter?.projectId ? { id: BigInt(filter.projectId) } : {}),
        ...(dateRange(filter?.since, filter?.until) ? { createdAt: dateRange(filter?.since, filter?.until) } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: take(filter),
      include: { client: true, service: true, steps: { orderBy: { position: "asc" } } },
    });
    return rows.map((p) => ({
      id: p.id.toString(),
      title: p.title,
      clientCompany: p.client.companyName,
      serviceName: p.service.name,
      status: p.status,
      progress: progressOf(p.steps),
      nextStep: p.steps.find((s) => !s.reachedAt)?.label ?? null,
      steps: p.steps.map((s) => ({ label: s.label, reachedAt: s.reachedAt?.toISOString() ?? null })),
      startDate: p.startDate?.toISOString() ?? null,
      dueDate: p.dueDate?.toISOString() ?? null,
      deliveredAt: p.deliveredAt?.toISOString() ?? null,
    }));
  },

  async deliverables(ctx, filter): Promise<DeliverableDTO[]> {
    const rows = await prisma.file.findMany({
      where: {
        kind: "LIVRABLE",
        deletedAt: null,
        project: { deletedAt: null, ...scope(ctx, filter), ...(filter?.projectId ? { id: BigInt(filter.projectId) } : {}) },
      },
      orderBy: { createdAt: "desc" },
      take: take(filter),
      include: { project: true },
    });
    return rows.map((f) => ({
      id: f.id.toString(),
      projectId: f.projectId.toString(),
      projectTitle: f.project.title,
      name: f.originalName,
      mime: f.mimeType,
      version: f.version,
      approval: f.approval,
      createdAt: f.createdAt.toISOString(),
      href: `/api/files/${f.publicId}`,
    }));
  },

  async teamMessages(ctx, filter): Promise<TeamMessageDTO[]> {
    // Le client lit ce que l'équipe lui a écrit ; l'équipe, ce que les clients ont écrit.
    const rows = await prisma.message.findMany({
      where: {
        sender: { role: ctx.role === "CLIENT" ? "ADMIN" : "CLIENT" },
        project: { deletedAt: null, ...scope(ctx, filter), ...(filter?.projectId ? { id: BigInt(filter.projectId) } : {}) },
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(filter?.limit ?? 3, 20),
      include: { sender: true, project: true },
    });
    return rows.map((m) => ({
      projectId: m.projectId.toString(),
      projectTitle: m.project.title,
      senderName: m.sender.fullName,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    }));
  },

  async profile(ctx): Promise<ProfileDTO | null> {
    if (ctx.role !== "CLIENT") return null;
    const clientId = clientScope(ctx);
    const [user, client] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: ctx.userId }, select: { fullName: true, email: true } }),
      prisma.client.findUniqueOrThrow({ where: { id: clientId } }),
    ]);
    return {
      fullName: user.fullName,
      email: user.email,
      companyName: client.companyName,
      contactName: client.contactName,
      phone: client.phone,
      address: client.address,
      city: client.city,
      country: client.country,
      complete: Boolean(client.address?.trim() && client.country?.trim()),
    };
  },
};
