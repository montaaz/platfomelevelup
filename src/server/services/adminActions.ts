import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { mirrorNotificationEmails } from "@/lib/mail";
import { assertAdmin, ForbiddenError, ValidationError, type Ctx } from "@/server/context";

const DEFAULT_STEPS = ["Brief reçu", "Production", "Première version", "Votre validation", "Livraison finale"];

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new ValidationError("Date invalide.");
  return d;
}

function requireText(value: string | undefined, label: string, max: number): string {
  const v = value?.trim();
  if (!v) throw new ValidationError(`${label} obligatoire.`);
  if (v.length > max) throw new ValidationError(`${label} trop long.`);
  return v;
}

/* ================================================================ clients */

export type ClientInput = {
  companyName: string;
  contactName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  taxId?: string;
  billingAddress?: string;
  notes?: string;
};

export async function createClient(ctx: Ctx, input: ClientInput) {
  assertAdmin(ctx);
  const client = await prisma.client.create({
    data: {
      companyName: requireText(input.companyName, "Nom de l'entreprise", 160),
      contactName: requireText(input.contactName, "Nom du contact", 160),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      taxId: input.taxId?.trim() || null,
      billingAddress: input.billingAddress?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
  await prisma.auditLog.create({
    data: { userId: ctx.userId, action: "CLIENT_CREATE", entityType: "client", entityId: client.id },
  });
  return { id: client.id.toString() };
}

export async function updateClient(ctx: Ctx, clientId: bigint, input: ClientInput) {
  assertAdmin(ctx);
  const existing = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } });
  if (!existing) throw new ForbiddenError();
  await prisma.client.update({
    where: { id: clientId },
    data: {
      companyName: requireText(input.companyName, "Nom de l'entreprise", 160),
      contactName: requireText(input.contactName, "Nom du contact", 160),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      address: input.address?.trim() || null,
      city: input.city?.trim() || null,
      taxId: input.taxId?.trim() || null,
      billingAddress: input.billingAddress?.trim() || null,
      notes: input.notes?.trim() || null,
    },
  });
  await prisma.auditLog.create({
    data: { userId: ctx.userId, action: "CLIENT_UPDATE", entityType: "client", entityId: clientId },
  });
  return true;
}

export async function getClient(ctx: Ctx, clientId: bigint) {
  assertAdmin(ctx);
  const c = await prisma.client.findFirst({ where: { id: clientId, deletedAt: null } });
  if (!c) throw new ForbiddenError();
  return {
    id: c.id.toString(),
    companyName: c.companyName,
    contactName: c.contactName,
    email: c.email,
    phone: c.phone,
    address: c.address,
    city: c.city,
    taxId: c.taxId,
    billingAddress: c.billingAddress,
    notes: c.notes,
  };
}

/* ================================================================ projects */

export type ProjectInput = {
  clientId: string;
  serviceId: string;
  title: string;
  description?: string;
  price: number;
  startDate?: string;
  dueDate?: string;
  assignedTeamMemberId?: string | null;
};

export async function createProject(ctx: Ctx, input: ProjectInput) {
  assertAdmin(ctx);
  if (!(input.price >= 0)) throw new ValidationError("Prix invalide.");

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        clientId: BigInt(input.clientId),
        serviceId: BigInt(input.serviceId),
        assignedTeamMemberId: input.assignedTeamMemberId ? BigInt(input.assignedTeamMemberId) : null,
        createdByUserId: ctx.userId,
        title: requireText(input.title, "Titre", 200),
        description: input.description?.trim() || null,
        price: new Prisma.Decimal(input.price),
        startDate: parseDate(input.startDate),
        dueDate: parseDate(input.dueDate),
      },
    });
    await tx.projectStep.createMany({
      data: DEFAULT_STEPS.map((label, i) => ({
        projectId: created.id,
        label,
        position: i + 1,
        reachedAt: i === 0 ? new Date() : null, // Brief reçu = created
      })),
    });
    await tx.projectStatusHistory.create({
      data: { projectId: created.id, newStatus: "EN_ATTENTE", changedByUserId: ctx.userId, comment: "Projet créé." },
    });
    // a created project appears immediately in the client's space (acceptance criterion)
    const clientUsers = await tx.user.findMany({
      where: { role: "CLIENT", clientId: created.clientId, isActive: true },
      select: { id: true },
    });
    if (clientUsers.length > 0) {
      await tx.notification.createMany({
        data: clientUsers.map((u) => ({
          userId: u.id,
          type: "STATUT_PROJET" as const,
          title: `Nouveau projet — ${created.title}`,
          body: "Votre projet a été créé et apparaît dans votre espace.",
          entityType: "project",
          entityId: created.id,
        })),
      });
    }
    return created;
  });

  await prisma.auditLog.create({
    data: { userId: ctx.userId, action: "PROJECT_CREATE", entityType: "project", entityId: project.id },
  });
  return { id: project.id.toString() };
}

const STATUS_FLOW = ["EN_ATTENTE", "EN_COURS", "EN_REVISION", "LIVRE", "CLOTURE"] as const;
type ProjectStatusValue = (typeof STATUS_FLOW)[number];

export async function updateProjectStatus(ctx: Ctx, projectId: bigint, status: string, comment?: string) {
  assertAdmin(ctx);
  if (!STATUS_FLOW.includes(status as ProjectStatusValue)) throw new ValidationError("Statut inconnu.");
  const newStatus = status as ProjectStatusValue;

  const project = await prisma.project.findFirst({ where: { id: projectId, deletedAt: null } });
  if (!project) throw new ForbiddenError();
  if (project.status === newStatus) return true;

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        status: newStatus,
        deliveredAt: newStatus === "LIVRE" ? new Date() : project.deliveredAt,
        closedAt: newStatus === "CLOTURE" ? new Date() : project.closedAt,
      },
    });
    await tx.projectStatusHistory.create({
      data: {
        projectId,
        oldStatus: project.status,
        newStatus,
        changedByUserId: ctx.userId,
        comment: comment?.trim() || null,
      },
    });
    const clientUsers = await tx.user.findMany({
      where: { role: "CLIENT", clientId: project.clientId, isActive: true },
      select: { id: true },
    });
    if (clientUsers.length > 0) {
      const title = `Statut mis à jour — ${project.title}`;
      const body = `Votre projet passe en « ${newStatus.replace("_", " ").toLowerCase()} ».`;
      await tx.notification.createMany({
        data: clientUsers.map((u) => ({
          userId: u.id,
          type: "STATUT_PROJET" as const,
          title,
          body,
          entityType: "project",
          entityId: projectId,
        })),
      });
      mirrorNotificationEmails(clientUsers.map((u) => u.id), title, body);
    }
  });
  return true;
}

export async function reachProjectStep(ctx: Ctx, projectId: bigint, position: number) {
  assertAdmin(ctx);
  const step = await prisma.projectStep.findFirst({ where: { projectId, position } });
  if (!step) throw new ForbiddenError();
  if (!step.reachedAt) {
    await prisma.projectStep.update({ where: { id: step.id }, data: { reachedAt: new Date() } });
  }
  return true;
}

export async function adminProjectDetail(ctx: Ctx, projectId: bigint) {
  assertAdmin(ctx);
  const p = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      client: true,
      service: true,
      assignedTo: true,
      steps: { orderBy: { position: "asc" } },
      files: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, include: { uploadedBy: true } },
      statusHistory: { orderBy: { createdAt: "desc" }, take: 10, include: { changedBy: true } },
      invoices: { orderBy: { issueDate: "desc" } },
    },
  });
  if (!p) throw new ForbiddenError();
  return {
    id: p.id.toString(),
    title: p.title,
    description: p.description,
    clientId: p.clientId.toString(),
    clientCompany: p.client.companyName,
    serviceName: p.service.name,
    assigneeName: p.assignedTo?.fullName ?? null,
    price: Number(p.price),
    status: p.status,
    startDate: p.startDate?.toISOString() ?? null,
    dueDate: p.dueDate?.toISOString() ?? null,
    steps: p.steps.map((s) => ({ position: s.position, label: s.label, reachedAt: s.reachedAt?.toISOString() ?? null })),
    files: p.files.map((f) => ({
      id: f.id.toString(),
      publicId: f.publicId,
      name: f.originalName,
      kind: f.kind,
      approval: f.approval,
      version: f.version,
      sizeBytes: Number(f.sizeBytes),
      uploadedByName: f.uploadedBy?.fullName ?? "—",
      createdAt: f.createdAt.toISOString(),
    })),
    history: p.statusHistory.map((h) => ({
      oldStatus: h.oldStatus,
      newStatus: h.newStatus,
      comment: h.comment,
      byName: h.changedBy?.fullName ?? "—",
      createdAt: h.createdAt.toISOString(),
    })),
    invoices: p.invoices.map((i) => ({
      id: i.id.toString(),
      number: i.invoiceNumber,
      status: i.status,
      total: Number(i.total),
    })),
  };
}

/* ================================================================ invoices */

export type InvoiceInput = {
  clientId: string;
  projectId?: string | null;
  dueDate?: string;
  vatRate: number;
  notes?: string;
  lines: { description: string; quantity: number; unitPrice: number }[];
};

export async function createInvoice(ctx: Ctx, input: InvoiceInput) {
  assertAdmin(ctx);
  if (!input.lines?.length) throw new ValidationError("Au moins une ligne est requise.");
  if (input.lines.length > 50) throw new ValidationError("Trop de lignes.");
  if (!(input.vatRate >= 0 && input.vatRate <= 100)) throw new ValidationError("Taux de TVA invalide.");

  const lines = input.lines.map((l, i) => {
    const description = requireText(l.description, `Ligne ${i + 1}`, 300);
    if (!(l.quantity > 0) || !(l.unitPrice >= 0)) throw new ValidationError(`Montants invalides ligne ${i + 1}.`);
    const lineTotal = Math.round(l.quantity * l.unitPrice * 1000) / 1000;
    return { description, quantity: l.quantity, unitPrice: l.unitPrice, lineTotal, position: i + 1 };
  });
  // totals recomputed server-side — client input is never trusted
  const subtotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 1000) / 1000;
  const vatAmount = Math.round(subtotal * (input.vatRate / 100) * 1000) / 1000;
  const total = Math.round((subtotal + vatAmount) * 1000) / 1000;

  const invoice = await prisma.$transaction(async (tx) => {
    // sequential, race-proof number from the SQL function (never duplicated)
    const year = new Date().getFullYear();
    const rows = await tx.$queryRaw<{ n: string }[]>`SELECT next_invoice_number(${year}::smallint) AS n`;
    const invoiceNumber = rows[0]!.n;

    const created = await tx.invoice.create({
      data: {
        invoiceNumber,
        clientId: BigInt(input.clientId),
        projectId: input.projectId ? BigInt(input.projectId) : null,
        status: "EN_ATTENTE",
        dueDate: parseDate(input.dueDate),
        subtotal: new Prisma.Decimal(subtotal),
        vatRate: new Prisma.Decimal(input.vatRate),
        vatAmount: new Prisma.Decimal(vatAmount),
        total: new Prisma.Decimal(total),
        notes: input.notes?.trim() || null,
        createdByUserId: ctx.userId,
        lines: { create: lines },
      },
    });

    const clientUsers = await tx.user.findMany({
      where: { role: "CLIENT", clientId: created.clientId, isActive: true },
      select: { id: true },
    });
    if (clientUsers.length > 0) {
      const title = `Nouvelle facture ${invoiceNumber}`;
      const body = `Montant TTC : ${total.toFixed(2)} DT.`;
      await tx.notification.createMany({
        data: clientUsers.map((u) => ({
          userId: u.id,
          type: "NOUVELLE_FACTURE" as const,
          title,
          body,
          entityType: "invoice",
          entityId: created.id,
        })),
      });
      mirrorNotificationEmails(clientUsers.map((u) => u.id), title, body);
    }
    return created;
  });

  await prisma.auditLog.create({
    data: { userId: ctx.userId, action: "INVOICE_CREATE", entityType: "invoice", entityId: invoice.id },
  });
  return { id: invoice.id.toString(), number: invoice.invoiceNumber };
}

export async function markInvoicePaid(ctx: Ctx, invoiceId: bigint, method: string, reference?: string) {
  assertAdmin(ctx);
  const METHODS = ["VIREMENT", "CARTE", "ESPECES", "CHEQUE", "EN_LIGNE"] as const;
  if (!METHODS.includes(method as (typeof METHODS)[number])) throw new ValidationError("Moyen de paiement inconnu.");

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, status: { in: ["EN_ATTENTE", "EN_RETARD"] } },
  });
  if (!invoice) throw new ForbiddenError();

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        invoiceId,
        amount: invoice.total,
        method: method as (typeof METHODS)[number],
        reference: reference?.trim() || null,
      },
    }),
    prisma.invoice.update({ where: { id: invoiceId }, data: { status: "PAYEE", paidAt: new Date() } }),
    prisma.auditLog.create({
      data: { userId: ctx.userId, action: "INVOICE_PAID", entityType: "invoice", entityId: invoiceId },
    }),
  ]);
  return true;
}

/* ======================================================== project requests */

export async function listProjectRequests(ctx: Ctx) {
  assertAdmin(ctx);
  const requests = await prisma.projectRequest.findMany({
    where: { status: { in: ["NOUVELLE", "EN_ETUDE"] } },
    orderBy: { createdAt: "desc" },
    include: { client: true, service: true, createdBy: true },
  });
  return requests.map((r) => ({
    id: r.id.toString(),
    clientId: r.clientId.toString(),
    clientCompany: r.client.companyName,
    serviceId: r.serviceId?.toString() ?? null,
    serviceName: r.service?.name ?? null,
    title: r.title,
    description: r.description,
    byName: r.createdBy?.fullName ?? r.client.contactName,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  }));
}

/** Accept: creates the project from the request (default service if none given). */
export async function acceptProjectRequest(ctx: Ctx, requestId: bigint, price: number, dueDate?: string) {
  assertAdmin(ctx);
  const request = await prisma.projectRequest.findFirst({
    where: { id: requestId, status: { in: ["NOUVELLE", "EN_ETUDE"] } },
    include: { service: true },
  });
  if (!request) throw new ForbiddenError();

  let serviceId = request.serviceId;
  if (!serviceId) {
    const first = await prisma.service.findFirst({ where: { isActive: true }, orderBy: { id: "asc" } });
    if (!first) throw new ValidationError("Aucun service défini.");
    serviceId = first.id;
  }

  const { id } = await createProject(ctx, {
    clientId: request.clientId.toString(),
    serviceId: serviceId.toString(),
    title: request.title,
    description: request.description ?? undefined,
    price,
    dueDate,
  });

  await prisma.projectRequest.update({
    where: { id: requestId },
    data: { status: "ACCEPTEE", createdProjectId: BigInt(id) },
  });
  return { projectId: id };
}

export async function refuseProjectRequest(ctx: Ctx, requestId: bigint, note?: string) {
  assertAdmin(ctx);
  const request = await prisma.projectRequest.findFirst({
    where: { id: requestId, status: { in: ["NOUVELLE", "EN_ETUDE"] } },
  });
  if (!request) throw new ForbiddenError();
  await prisma.projectRequest.update({
    where: { id: requestId },
    data: { status: "REFUSEE", adminNote: note?.trim() || null },
  });
  return true;
}

/* ========================================================== user accounts */
/* Login accounts live in the database (users table) and are managed here. */

export async function listUserAccounts(ctx: Ctx) {
  assertAdmin(ctx);
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
    include: { client: { select: { companyName: true } } },
  });
  return users.map((u) => ({
    id: u.id.toString(),
    fullName: u.fullName,
    email: u.email,
    role: u.role,
    clientCompany: u.client?.companyName ?? null,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    isSelf: u.id === ctx.userId,
  }));
}

export type UserAccountInput = {
  role: "ADMIN" | "CLIENT";
  fullName: string;
  email: string;
  password: string;
  clientId?: string | null;
};

export async function createUserAccount(ctx: Ctx, input: UserAccountInput) {
  assertAdmin(ctx);
  const fullName = requireText(input.fullName, "Nom complet", 160);
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError("Adresse e-mail invalide.");
  if (input.password.length < 8) throw new ValidationError("Le mot de passe doit contenir au moins 8 caractères.");
  if (input.role !== "ADMIN" && input.role !== "CLIENT") throw new ValidationError("Rôle inconnu.");
  if (input.role === "CLIENT" && !input.clientId) throw new ValidationError("Un compte client doit être rattaché à un client.");

  try {
    const user = await prisma.user.create({
      data: {
        role: input.role,
        clientId: input.role === "CLIENT" ? BigInt(input.clientId!) : null,
        fullName,
        email,
        passwordHash: await bcrypt.hash(input.password, 12),
      },
    });
    await prisma.auditLog.create({
      data: { userId: ctx.userId, action: "USER_CREATE", entityType: "user", entityId: user.id },
    });
    return { id: user.id.toString() };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new ValidationError("Cette adresse e-mail est déjà utilisée.");
    }
    throw e;
  }
}

/** Admin sets a new password for a user (e.g. forgotten password). */
export async function resetUserPassword(ctx: Ctx, userId: bigint, newPassword: string) {
  assertAdmin(ctx);
  if (newPassword.length < 8) throw new ValidationError("Le mot de passe doit contenir au moins 8 caractères.");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ForbiddenError();
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(newPassword, 12), failedLoginAttempts: 0, lockedUntil: null },
  });
  await prisma.auditLog.create({
    data: { userId: ctx.userId, action: "USER_PASSWORD_RESET", entityType: "user", entityId: userId },
  });
  return true;
}

/** Enable / disable a login account (never your own). */
export async function setUserActive(ctx: Ctx, userId: bigint, active: boolean) {
  assertAdmin(ctx);
  if (userId === ctx.userId) throw new ValidationError("Vous ne pouvez pas désactiver votre propre compte.");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ForbiddenError();
  await prisma.user.update({ where: { id: userId }, data: { isActive: active } });
  await prisma.auditLog.create({
    data: { userId: ctx.userId, action: active ? "USER_ENABLE" : "USER_DISABLE", entityType: "user", entityId: userId },
  });
  return true;
}
