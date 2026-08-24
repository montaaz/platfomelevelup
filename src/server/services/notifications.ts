import { prisma } from "@/lib/prisma";
import type { Ctx } from "@/server/context";

/** Where a notification points to, per role — "the alert links to the element". */
function notificationHref(role: "ADMIN" | "CLIENT", type: string, entityType: string | null, entityId: bigint | null): string {
  const id = entityId?.toString();
  if (role === "ADMIN") {
    if (type === "NOUVEAU_MESSAGE" && id) return `/admin/messagerie/${id}`;
    if (entityType === "project" && id) return `/admin/projets/${id}`;
    if (entityType === "invoice" && id) return `/admin/factures/${id}`;
    if (entityType === "project_request") return "/admin/projets";
    if (entityType === "subscription") return "/admin/abonnements";
    return "/admin";
  }
  if (type === "NOUVEAU_MESSAGE" && id) return `/client/messages/${id}`;
  if (entityType === "invoice" && id) return `/client/factures/${id}`;
  if (entityType === "project") return "/client";
  return "/client";
}

export async function listNotifications(ctx: Ctx, limit = 12) {
  const rows = await prisma.notification.findMany({
    where: { userId: ctx.userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((n) => ({
    id: n.id.toString(),
    type: n.type,
    title: n.title,
    body: n.body,
    href: notificationHref(ctx.role, n.type, n.entityType, n.entityId),
    read: n.readAt != null,
    createdAt: n.createdAt.toISOString(),
  }));
}

export async function markAllNotificationsRead(ctx: Ctx) {
  await prisma.notification.updateMany({
    where: { userId: ctx.userId, readAt: null },
    data: { readAt: new Date() },
  });
  return true;
}
