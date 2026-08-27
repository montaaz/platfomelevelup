import { prisma } from "@/lib/prisma";
import type { Ctx } from "@/server/context";
import { INVOICE_STATUS_LABEL, PROJECT_STATUS_LABEL } from "@/lib/format";

export type SearchHit = {
  type: "client" | "project" | "invoice" | "team" | "message" | "file";
  title: string;
  subtitle: string | null;
  badge: string | null;
  href: string;
};

const PER_GROUP = 5;

/** Global search. Admin: whole agency. Client: strictly their own data (scoped in SQL). */
export async function globalSearch(ctx: Ctx, rawQuery: string): Promise<SearchHit[]> {
  const q = rawQuery.trim().slice(0, 80);
  if (q.length < 2) return [];
  const like = { contains: q, mode: "insensitive" as const };
  const isAdmin = ctx.role === "ADMIN";
  const clientScope = isAdmin ? {} : { clientId: ctx.clientId ?? BigInt(-1) };
  const base = isAdmin ? "/admin" : "/client";

  const [clients, projects, invoices, team, messages, files] = await Promise.all([
    isAdmin
      ? prisma.client.findMany({
          where: { deletedAt: null, OR: [{ companyName: like }, { contactName: like }, { email: like }, { phone: like }, { city: like }] },
          take: PER_GROUP,
          orderBy: { companyName: "asc" },
        })
      : Promise.resolve([]),
    prisma.project.findMany({
      where: { deletedAt: null, ...clientScope, OR: [{ title: like }, { description: like }, { client: { companyName: like } }, { service: { name: like } }] },
      take: PER_GROUP,
      orderBy: { updatedAt: "desc" },
      include: { client: true, service: true },
    }),
    prisma.invoice.findMany({
      where: { status: { not: "BROUILLON" }, ...clientScope, OR: [{ invoiceNumber: like }, { client: { companyName: like } }, { project: { title: like } }, { lines: { some: { description: like } } }] },
      take: PER_GROUP,
      orderBy: { issueDate: "desc" },
      include: { client: true },
    }),
    isAdmin
      ? prisma.teamMember.findMany({ where: { isActive: true, OR: [{ fullName: like }, { jobTitle: like }, { email: like }] }, take: PER_GROUP })
      : Promise.resolve([]),
    prisma.message.findMany({
      where: { body: like, project: { deletedAt: null, ...clientScope } },
      take: PER_GROUP,
      orderBy: { createdAt: "desc" },
      include: { project: { include: { client: true } }, sender: true },
    }),
    prisma.file.findMany({
      where: { deletedAt: null, originalName: like, project: { deletedAt: null, ...clientScope }, ...(isAdmin ? {} : { kind: "LIVRABLE" as const }) },
      take: PER_GROUP,
      orderBy: { createdAt: "desc" },
      include: { project: true },
    }),
  ]);

  const hits: SearchHit[] = [];
  for (const c of clients)
    hits.push({ type: "client", title: c.companyName, subtitle: `${c.contactName}${c.city ? " · " + c.city : ""}`, badge: null, href: "/admin/clients" });
  for (const p of projects)
    hits.push({
      type: "project",
      title: p.title,
      subtitle: isAdmin ? `${p.client.companyName} · ${p.service.name}` : p.service.name,
      badge: PROJECT_STATUS_LABEL[p.status] ?? p.status,
      href: isAdmin ? `/admin/projets/${p.id}` : "/client",
    });
  for (const i of invoices)
    hits.push({
      type: "invoice",
      title: i.invoiceNumber,
      subtitle: `${isAdmin ? i.client.companyName + " · " : ""}${Number(i.total).toFixed(2)} DT`,
      badge: INVOICE_STATUS_LABEL[i.status] ?? i.status,
      href: `${base}/factures/${i.id}`,
    });
  for (const t of team) hits.push({ type: "team", title: t.fullName, subtitle: t.jobTitle, badge: null, href: "/admin/equipe" });
  for (const m of messages)
    hits.push({
      type: "message",
      title: m.body.length > 90 ? m.body.slice(0, 90) + "…" : m.body,
      subtitle: `${m.sender.fullName} · ${m.project.title}`,
      badge: null,
      href: isAdmin ? `/admin/messagerie/${m.projectId}` : `/client/messages/${m.projectId}`,
    });
  for (const f of files)
    hits.push({ type: "file", title: f.originalName, subtitle: `${f.project.title} · v${f.version}`, badge: null, href: `/api/files/${f.publicId}` });

  return hits;
}
