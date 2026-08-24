import { prisma } from "@/lib/prisma";
import { ForbiddenError, clientScope, type Ctx } from "@/server/context";

/** Client approves the latest deliverable → project moves to LIVRE. */
export async function approveDeliverable(ctx: Ctx, fileId: bigint) {
  const clientId = clientScope(ctx);
  const file = await prisma.file.findFirst({
    where: { id: fileId, kind: "LIVRABLE", deletedAt: null, project: { clientId, deletedAt: null } },
    include: { project: true },
  });
  if (!file) throw new ForbiddenError();

  await prisma.$transaction(async (tx) => {
    await tx.file.update({ where: { id: file.id }, data: { approval: "APPROUVE" } });
    await tx.project.update({
      where: { id: file.projectId },
      data: { status: "LIVRE", deliveredAt: new Date() },
    });
    await tx.projectStatusHistory.create({
      data: {
        projectId: file.projectId,
        oldStatus: file.project.status,
        newStatus: "LIVRE",
        changedByUserId: ctx.userId,
        comment: `Livrable "${file.originalName}" approuvé par le client.`,
      },
    });
    await tx.projectStep.updateMany({
      where: { projectId: file.projectId, reachedAt: null },
      data: { reachedAt: new Date() },
    });
    const admins = await tx.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
    await tx.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "STATUT_PROJET" as const,
        title: `Livrable approuvé — ${file.project.title}`,
        body: `${ctx.fullName} a approuvé « ${file.originalName} ». Le projet passe en Livré.`,
        entityType: "project",
        entityId: file.projectId,
      })),
    });
  });
  return true;
}

/** Client requests a revision on a deliverable → project back to EN_COURS + message. */
export async function requestRevision(ctx: Ctx, fileId: bigint, comment: string) {
  const clientId = clientScope(ctx);
  const trimmed = comment.trim();
  if (!trimmed || trimmed.length > 2000) throw new Error("Merci d'expliquer ce qui doit changer.");

  const file = await prisma.file.findFirst({
    where: { id: fileId, kind: "LIVRABLE", deletedAt: null, project: { clientId, deletedAt: null } },
    include: { project: true },
  });
  if (!file) throw new ForbiddenError();

  await prisma.$transaction(async (tx) => {
    await tx.file.update({ where: { id: file.id }, data: { approval: "REVISION_DEMANDEE" } });
    await tx.project.update({ where: { id: file.projectId }, data: { status: "EN_COURS" } });
    await tx.projectStatusHistory.create({
      data: {
        projectId: file.projectId,
        oldStatus: file.project.status,
        newStatus: "EN_COURS",
        changedByUserId: ctx.userId,
        comment: `Révision demandée sur "${file.originalName}".`,
      },
    });
    await tx.message.create({
      data: {
        projectId: file.projectId,
        senderUserId: ctx.userId,
        body: `Demande de révision sur « ${file.originalName} » : ${trimmed}`,
      },
    });
    const admins = await tx.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
    await tx.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "STATUT_PROJET" as const,
        title: `Révision demandée — ${file.project.title}`,
        body: trimmed.slice(0, 200),
        entityType: "project",
        entityId: file.projectId,
      })),
    });
  });
  return true;
}

/** "Nouveau projet / devis" form → request visible admin-side. */
export async function createProjectRequest(
  ctx: Ctx,
  input: { title: string; description: string; serviceId?: bigint | null },
) {
  const clientId = clientScope(ctx);
  const title = input.title.trim();
  if (!title || title.length > 200) throw new Error("Titre invalide.");

  const request = await prisma.projectRequest.create({
    data: {
      clientId,
      createdByUserId: ctx.userId,
      serviceId: input.serviceId ?? null,
      title,
      description: input.description.trim() || null,
    },
  });

  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      type: "DEMANDE_PROJET" as const,
      title: `Nouvelle demande — ${title}`,
      body: input.description?.slice(0, 200) || null,
      entityType: "project_request",
      entityId: request.id,
    })),
  });

  return { id: request.id.toString() };
}

/** Profile: contact + billing info, reused on the following invoices. */
export async function getMyProfile(ctx: Ctx) {
  const clientId = clientScope(ctx);
  const [user, client] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: ctx.userId } }),
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
    taxId: client.taxId,
    billingAddress: client.billingAddress,
  };
}

export async function updateMyProfile(
  ctx: Ctx,
  input: {
    fullName?: string;
    phone?: string;
    address?: string;
    city?: string;
    taxId?: string;
    billingAddress?: string;
  },
) {
  const clientId = clientScope(ctx);
  if (input.fullName !== undefined) {
    const name = input.fullName.trim();
    if (!name || name.length > 160) throw new Error("Nom invalide.");
    await prisma.user.update({ where: { id: ctx.userId }, data: { fullName: name } });
  }
  await prisma.client.update({
    where: { id: clientId },
    data: {
      phone: input.phone?.trim() || undefined,
      address: input.address?.trim() || undefined,
      city: input.city?.trim() || undefined,
      taxId: input.taxId?.trim() || undefined,
      billingAddress: input.billingAddress?.trim() || undefined,
    },
  });
  return true;
}

export async function listServicesPublic() {
  const services = await prisma.service.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  return services.map((s) => ({ id: s.id.toString(), name: s.name, description: s.description }));
}
