import { prisma } from "@/lib/prisma";
import { assertTeam, ForbiddenError, type Ctx } from "@/server/context";

/**
 * Espace équipe (notes de Sarra, §03) : projets, échéances et clients.
 * AUCUNE donnée financière : ces requêtes ne sélectionnent jamais un prix,
 * une facture, une commande, un paiement ou un abonnement.
 */

const now = () => new Date();

export async function teamProjects(ctx: Ctx) {
  assertTeam(ctx);
  const rows = await prisma.project.findMany({
    where: { deletedAt: null, status: { notIn: ["CLOTURE"] } },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    select: {
      id: true, title: true, status: true, dueDate: true, startDate: true,
      client: { select: { id: true, companyName: true } },
      service: { select: { name: true } },
      assignedTo: { select: { fullName: true, userId: true } },
      steps: { select: { label: true, position: true, reachedAt: true }, orderBy: { position: "asc" } },
    },
  });
  return rows.map((p) => ({
    id: p.id.toString(), title: p.title, status: p.status, service: p.service.name,
    client: { id: p.client.id.toString(), name: p.client.companyName },
    assignee: p.assignedTo?.fullName ?? null, mine: p.assignedTo?.userId === ctx.userId,
    dueDate: p.dueDate?.toISOString() ?? null, startDate: p.startDate?.toISOString() ?? null,
    overdue: !!p.dueDate && p.dueDate < now() && !["LIVRE", "CLOTURE"].includes(p.status),
    // Avancement lu sur les étapes franchies (prochaine étape = la première non franchie).
    nextStep: p.steps.find((s) => !s.reachedAt)?.label ?? null,
    progress: p.steps.length ? Math.round((p.steps.filter((s) => s.reachedAt).length / p.steps.length) * 100) : 0,
    steps: p.steps.map((s) => ({ label: s.label, reached: !!s.reachedAt })),
  }));
}

export async function teamProject(ctx: Ctx, id: bigint) {
  assertTeam(ctx);
  const p = await prisma.project.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true, title: true, description: true, status: true, dueDate: true, startDate: true, deliveredAt: true,
      client: { select: { id: true, companyName: true, contactName: true, email: true, phone: true, country: true, mainNeeds: true, needsDetails: true } },
      service: { select: { name: true } },
      assignedTo: { select: { fullName: true } },
      steps: { select: { label: true, position: true, reachedAt: true }, orderBy: { position: "asc" } },
      files: { where: { deletedAt: null }, select: { publicId: true, originalName: true, kind: true, approval: true, version: true, createdAt: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!p) throw new ForbiddenError();
  return p;
}

export async function teamClients(ctx: Ctx) {
  assertTeam(ctx);
  const rows = await prisma.client.findMany({
    where: { deletedAt: null },
    orderBy: { companyName: "asc" },
    select: {
      id: true, companyName: true, contactName: true, email: true, phone: true, country: true, detectedCountry: true,
      projects: { where: { deletedAt: null }, select: { id: true, title: true, status: true, dueDate: true } },
    },
  });
  return rows.map((c) => ({
    id: c.id.toString(), name: c.companyName, contact: c.contactName, email: c.email, phone: c.phone,
    country: c.country || c.detectedCountry || null,
    projects: c.projects.map((p) => ({ id: p.id.toString(), title: p.title, status: p.status, dueDate: p.dueDate?.toISOString() ?? null })),
  }));
}
