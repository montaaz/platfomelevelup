import { prisma } from "@/lib/prisma";
import { assertAdmin, clientScope, ForbiddenError, type Ctx } from "@/server/context";

/* Admin lists: clients, projets, équipe, factures, abonnements.
   Client lists: mes factures, historique. Every query is scoped by role. */

export async function listClients(ctx: Ctx) {
  assertAdmin(ctx);
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    orderBy: { companyName: "asc" },
    include: {
      projects: { where: { deletedAt: null }, select: { status: true } },
      invoices: { select: { status: true, total: true } },
      subscriptions: { where: { status: "ACTIF" }, select: { planName: true } },
    },
  });
  return clients.map((c) => ({
    id: c.id.toString(),
    companyName: c.companyName,
    contactName: c.contactName,
    email: c.email,
    phone: c.phone,
    city: c.city,
    address: c.address,
    taxId: c.taxId,
    billingAddress: c.billingAddress,
    notes: c.notes,
    activeProjects: c.projects.filter((p) => p.status !== "CLOTURE" && p.status !== "LIVRE").length,
    totalProjects: c.projects.length,
    unpaidTotal: c.invoices
      .filter((i) => i.status === "EN_ATTENTE" || i.status === "EN_RETARD")
      .reduce((s, i) => s + Number(i.total), 0),
    paidTotal: c.invoices.filter((i) => i.status === "PAYEE").reduce((s, i) => s + Number(i.total), 0),
    subscription: c.subscriptions[0]?.planName ?? null,
    isActive: c.isActive,
  }));
}

export async function listProjects(ctx: Ctx) {
  assertAdmin(ctx);
  const projects = await prisma.project.findMany({
    where: { deletedAt: null },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    include: { client: true, service: true, assignedTo: true },
  });
  const now = new Date();
  return projects.map((p) => ({
    id: p.id.toString(),
    title: p.title,
    clientId: p.clientId.toString(),
    clientCompany: p.client.companyName,
    serviceName: p.service.name,
    price: Number(p.price),
    status: p.status,
    assigneeName: p.assignedTo?.fullName ?? null,
    startDate: p.startDate?.toISOString() ?? null,
    dueDate: p.dueDate?.toISOString() ?? null,
    overdue: !!p.dueDate && p.dueDate < now && !["LIVRE", "CLOTURE"].includes(p.status),
  }));
}

export async function listTeam(ctx: Ctx) {
  assertAdmin(ctx);
  const members = await prisma.teamMember.findMany({
    where: { isActive: true },
    orderBy: { fullName: "asc" },
    include: {
      assignedProjects: {
        where: { deletedAt: null },
        select: { status: true, title: true, client: { select: { companyName: true } } },
      },
    },
  });
  return members.map((m) => ({
    id: m.id.toString(),
    fullName: m.fullName,
    email: m.email,
    phone: m.phone,
    jobTitle: m.jobTitle,
    activeProjects: m.assignedProjects.filter((p) => !["LIVRE", "CLOTURE"].includes(p.status)).length,
    totalProjects: m.assignedProjects.length,
    currentWork: m.assignedProjects
      .filter((p) => !["LIVRE", "CLOTURE"].includes(p.status))
      .slice(0, 3)
      .map((p) => `${p.client.companyName} — ${p.title}`),
  }));
}

export async function listInvoices(ctx: Ctx) {
  const where =
    ctx.role === "ADMIN"
      ? { status: { not: "BROUILLON" as const } }
      : { clientId: clientScope(ctx), status: { not: "BROUILLON" as const } };

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { issueDate: "desc" },
    include: { client: true, project: { include: { service: true } }, lines: true },
  });
  return invoices.map((i) => ({
    id: i.id.toString(),
    number: i.invoiceNumber,
    clientCompany: i.client.companyName,
    projectTitle: i.project?.title ?? null,
    serviceName: i.project?.service.name ?? null,
    status: i.status,
    issueDate: i.issueDate.toISOString(),
    dueDate: i.dueDate?.toISOString() ?? null,
    subtotal: Number(i.subtotal),
    vatRate: Number(i.vatRate),
    vatAmount: Number(i.vatAmount),
    total: Number(i.total),
    lines: i.lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal),
    })),
  }));
}

/** One invoice with full detail — admin: any; client: own only (scoped in SQL). */
export async function getInvoice(ctx: Ctx, invoiceId: bigint) {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      status: { not: "BROUILLON" },
      ...(ctx.role === "CLIENT" ? { clientId: clientScope(ctx) } : {}),
    },
    include: { client: true, project: { include: { service: true } }, lines: { orderBy: { position: "asc" } }, payments: true },
  });
  if (!invoice) throw new ForbiddenError();
  return {
    id: invoice.id.toString(),
    number: invoice.invoiceNumber,
    status: invoice.status,
    issueDate: invoice.issueDate.toISOString(),
    dueDate: invoice.dueDate?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    subtotal: Number(invoice.subtotal),
    vatRate: Number(invoice.vatRate),
    vatAmount: Number(invoice.vatAmount),
    total: Number(invoice.total),
    notes: invoice.notes,
    projectTitle: invoice.project?.title ?? null,
    serviceName: invoice.project?.service.name ?? null,
    client: {
      companyName: invoice.client.companyName,
      contactName: invoice.client.contactName,
      email: invoice.client.email,
      phone: invoice.client.phone,
      address: invoice.client.billingAddress ?? invoice.client.address,
      city: invoice.client.city,
      country: invoice.client.country,
      taxId: invoice.client.taxId,
    },
    lines: invoice.lines.map((l) => ({
      description: l.description,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice),
      lineTotal: Number(l.lineTotal),
    })),
    payments: invoice.payments.map((p) => ({
      amount: Number(p.amount),
      method: p.method,
      reference: p.reference,
      paidAt: p.paidAt.toISOString(),
    })),
  };
}

export async function listSubscriptions(ctx: Ctx) {
  assertAdmin(ctx);
  const subs = await prisma.subscription.findMany({
    orderBy: { renewalDate: "asc" },
    include: { client: true },
  });
  const soon = new Date(Date.now() + 14 * 86_400_000);
  return subs.map((s) => ({
    id: s.id.toString(),
    clientCompany: s.client.companyName,
    planName: s.planName,
    monthlyAmount: Number(s.monthlyAmount),
    status: s.status,
    autoRenew: s.autoRenew,
    startDate: s.startDate.toISOString(),
    renewalDate: s.renewalDate.toISOString(),
    renewalSoon: s.status === "ACTIF" && s.renewalDate <= soon,
  }));
}

/** Client history: every project past and current, with dates and amounts. */
export async function clientHistory(ctx: Ctx) {
  const clientId = clientScope(ctx);
  const projects = await prisma.project.findMany({
    where: { clientId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { service: true, invoices: { where: { status: { not: "ANNULEE" } } } },
  });
  return projects.map((p) => ({
    id: p.id.toString(),
    title: p.title,
    serviceName: p.service.name,
    status: p.status,
    price: Number(p.price),
    startDate: p.startDate?.toISOString() ?? null,
    deliveredAt: p.deliveredAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    invoicedTotal: p.invoices.reduce((s, i) => s + Number(i.total), 0),
  }));
}
