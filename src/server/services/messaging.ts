import { prisma } from "@/lib/prisma";
import { mirrorNotificationEmails } from "@/lib/mail";
import { ForbiddenError, ValidationError, type Ctx } from "@/server/context";

/** Throws unless the user may access this project (admin: all; client: own only). */
export async function assertProjectAccess(ctx: Ctx, projectId: bigint) {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      deletedAt: null,
      ...(ctx.role === "CLIENT" ? { clientId: ctx.clientId ?? BigInt(-1) } : {}),
    },
    select: { id: true, clientId: true, title: true },
  });
  if (!project) throw new ForbiddenError();
  return project;
}

/** One thread per project the user can see, with unread count and last message. */
export async function listThreads(ctx: Ctx) {
  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null,
      messages: { some: {} },
      ...(ctx.role === "CLIENT" ? { clientId: ctx.clientId ?? BigInt(-1) } : {}),
    },
    include: {
      client: true,
      service: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1, include: { sender: true } },
    },
  });

  const withUnread = await Promise.all(
    projects.map(async (p) => {
      const unread = await prisma.message.count({
        where: {
          projectId: p.id,
          senderUserId: { not: ctx.userId },
          reads: { none: { userId: ctx.userId } },
        },
      });
      const last = p.messages[0]!;
      return {
        projectId: p.id.toString(),
        projectTitle: p.title,
        clientCompany: p.client.companyName,
        serviceName: p.service.name,
        lastMessage: last.body.length > 120 ? last.body.slice(0, 120) + "…" : last.body,
        lastSenderName: last.sender.fullName,
        lastAt: last.createdAt.toISOString(),
        unread,
      };
    }),
  );

  return withUnread.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** Full thread; marks every message as read for this user. */
export async function getThread(ctx: Ctx, projectId: bigint) {
  const project = await assertProjectAccess(ctx, projectId);

  const messages = await prisma.message.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
    include: { sender: true },
  });

  const unreadIds = await prisma.message.findMany({
    where: { projectId, senderUserId: { not: ctx.userId }, reads: { none: { userId: ctx.userId } } },
    select: { id: true },
  });
  if (unreadIds.length > 0) {
    await prisma.messageRead.createMany({
      data: unreadIds.map((m) => ({ messageId: m.id, userId: ctx.userId })),
      skipDuplicates: true,
    });
  }

  return {
    projectId: project.id.toString(),
    projectTitle: project.title,
    messages: messages.map((m) => ({
      id: m.id.toString(),
      body: m.body,
      senderName: m.sender.fullName,
      senderRole: m.sender.role,
      mine: m.senderUserId === ctx.userId,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

/** Sends a message and notifies the other side (dashboard bell; e-mail later). */
export async function sendMessage(ctx: Ctx, projectId: bigint, body: string) {
  const trimmed = body.trim();
  if (!trimmed || trimmed.length > 5000) throw new ValidationError("Message invalide.");
  const project = await assertProjectAccess(ctx, projectId);

  const message = await prisma.message.create({
    data: { projectId, senderUserId: ctx.userId, body: trimmed },
  });

  // notify the other side, attached to the project (acceptance criterion)
  const recipients = await prisma.user.findMany({
    where:
      ctx.role === "CLIENT"
        ? { role: "ADMIN", isActive: true }
        : { role: "CLIENT", clientId: project.clientId, isActive: true },
    select: { id: true },
  });
  if (recipients.length > 0) {
    const title = `Nouveau message — ${project.title}`;
    await prisma.notification.createMany({
      data: recipients.map((r) => ({
        userId: r.id,
        type: "NOUVEAU_MESSAGE" as const,
        title,
        body: trimmed.slice(0, 200),
        entityType: "project",
        entityId: projectId,
      })),
    });
    mirrorNotificationEmails(recipients.map((r) => r.id), title, trimmed.slice(0, 200));
  }

  return { id: message.id.toString(), createdAt: message.createdAt.toISOString() };
}

export async function unreadTotal(ctx: Ctx) {
  return prisma.message.count({
    where: {
      senderUserId: { not: ctx.userId },
      reads: { none: { userId: ctx.userId } },
      project: {
        deletedAt: null,
        ...(ctx.role === "CLIENT" ? { clientId: ctx.clientId ?? BigInt(-1) } : {}),
      },
    },
  });
}
