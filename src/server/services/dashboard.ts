import { prisma } from "@/lib/prisma";
import { assertAdmin, clientScope, type Ctx } from "@/server/context";

const ACTIVE_STATUSES = ["EN_ATTENTE", "EN_COURS", "EN_REVISION"] as const;

/* ============================================================ ADMIN */

export async function adminDashboard(ctx: Ctx, periodDays: 7 | 30 | 365 = 30) {
  assertAdmin(ctx);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const periodStart = new Date(now.getTime() - periodDays * 86_400_000);

  const [
    paidThisMonth,
    paidPrevMonth,
    activeProjects,
    newThisWeek,
    unpaid,
    revisionCount,
    revenueByMonth,
    revenueByService,
    currentProjects,
    recentThreads,
    invoicesToFollow,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: { status: "PAYEE", issueDate: { gte: monthStart } },
    }),
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: { status: "PAYEE", issueDate: { gte: prevMonthStart, lt: monthStart } },
    }),
    prisma.project.count({ where: { status: { in: [...ACTIVE_STATUSES] }, deletedAt: null } }),
    prisma.project.count({ where: { createdAt: { gte: weekAgo }, deletedAt: null } }),
    prisma.invoice.aggregate({
      _count: true,
      _sum: { total: true },
      where: { status: { in: ["EN_ATTENTE", "EN_RETARD"] } },
    }),
    prisma.project.count({ where: { status: "EN_REVISION", deletedAt: null } }),
    prisma.$queryRaw<{ month: Date; paid_total: unknown }[]>`
      SELECT month, paid_total FROM v_revenue_by_month
      WHERE month >= date_trunc('month', now()) - interval '11 months'
      ORDER BY month`,
    prisma.$queryRaw<{ name: string; color: string | null; project_count: bigint; total: unknown }[]>`
      SELECT s.name, s.color,
             COUNT(DISTINCT p.id) AS project_count,
             COALESCE(SUM(i.total), 0) AS total
      FROM services s
      JOIN projects p ON p.service_id = s.id AND p.deleted_at IS NULL
      LEFT JOIN invoices i ON i.project_id = p.id
        AND i.status NOT IN ('ANNULEE','BROUILLON')
        AND i.issue_date >= ${periodStart}
      WHERE p.created_at >= ${periodStart} OR i.id IS NOT NULL
      GROUP BY s.id, s.name, s.color
      HAVING COALESCE(SUM(i.total), 0) > 0 OR COUNT(DISTINCT p.id) > 0
      ORDER BY total DESC
      LIMIT 5`,
    prisma.project.findMany({
      where: { deletedAt: null, status: { not: "CLOTURE" } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
      take: 5,
      include: { client: true, service: true, assignedTo: true },
    }),
    prisma.message.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        sender: true,
        project: { include: { client: true, service: true } },
        reads: { where: { userId: ctx.userId } },
      },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ["EN_ATTENTE", "EN_RETARD", "PAYEE"] } },
      orderBy: [{ issueDate: "desc" }],
      take: 4,
      include: { client: true },
    }),
  ]);

  const revThisMonth = Number(paidThisMonth._sum.total ?? 0);
  const revPrevMonth = Number(paidPrevMonth._sum.total ?? 0);

  // one thread preview per project, newest first
  const seen = new Set<string>();
  const threads = recentThreads
    .filter((m) => {
      const key = m.projectId.toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .map((m) => ({
      projectId: m.projectId.toString(),
      clientCompany: m.project.client.companyName,
      projectTitle: m.project.title,
      serviceName: m.project.service.name,
      excerpt: m.body.length > 110 ? m.body.slice(0, 110) + "…" : m.body,
      senderName: m.sender.fullName,
      isFromClient: m.sender.role === "CLIENT",
      createdAt: m.createdAt.toISOString(),
      unread: m.reads.length === 0 && m.senderUserId !== ctx.userId,
    }));

  return {
    kpis: {
      revenueMonth: revThisMonth,
      revenueTrendPct: revPrevMonth > 0 ? Math.round(((revThisMonth - revPrevMonth) / revPrevMonth) * 100) : null,
      projectsInProgress: activeProjects,
      newProjectsThisWeek: newThisWeek,
      unpaidCount: unpaid._count,
      unpaidTotal: Number(unpaid._sum.total ?? 0),
      revisionRequests: revisionCount,
    },
    revenueByMonth: revenueByMonth.map((r) => ({
      month: r.month.toISOString(),
      total: Number(r.paid_total ?? 0),
    })),
    revenueByService: revenueByService.map((r) => ({
      name: r.name,
      color: r.color,
      projectCount: Number(r.project_count),
      total: Number(r.total ?? 0),
    })),
    currentProjects: currentProjects.map((p) => ({
      id: p.id.toString(),
      title: p.client.companyName,
      subtitle: `${p.service.name} — ${p.title}`,
      clientCompany: p.client.companyName,
      serviceName: p.service.name,
      status: p.status,
      assigneeName: p.assignedTo?.fullName ?? null,
      dueDate: p.dueDate?.toISOString() ?? null,
      overdue: !!p.dueDate && p.dueDate < now && !["LIVRE", "CLOTURE"].includes(p.status),
    })),
    threads,
    invoicesToFollow: invoicesToFollow.map((i) => ({
      id: i.id.toString(),
      number: i.invoiceNumber,
      clientCompany: i.client.companyName,
      status: i.status,
      total: Number(i.total),
    })),
  };
}

export type AdminDashboardData = Awaited<ReturnType<typeof adminDashboard>>;

/* ============================================================ CLIENT */

function projectProgress(steps: { reachedAt: Date | null }[]) {
  if (steps.length === 0) return 0;
  return Math.round((steps.filter((s) => s.reachedAt).length / steps.length) * 100);
}

export async function clientHome(ctx: Ctx) {
  const clientId = clientScope(ctx);

  const projects = await prisma.project.findMany({
    where: { clientId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      service: true,
      steps: { orderBy: { position: "asc" } },
      files: { where: { kind: "LIVRABLE", deletedAt: null }, orderBy: { createdAt: "desc" } },
      invoices: { where: { status: { in: ["EN_ATTENTE", "EN_RETARD"] } } },
    },
  });

  const active = projects.filter((p) => !["CLOTURE"].includes(p.status));
  // The project awaiting client action comes first (EN_REVISION), else most recent active
  const featured = active.find((p) => p.status === "EN_REVISION") ?? active[0] ?? null;
  const others = active.filter((p) => p !== featured);

  const teamMessages = await prisma.message.findMany({
    where: { project: { clientId }, sender: { role: "ADMIN" } },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: {
      sender: true,
      project: { include: { service: true } },
      reads: { where: { userId: ctx.userId } },
    },
  });

  const unreadCount = await prisma.message.count({
    where: {
      project: { clientId },
      senderUserId: { not: ctx.userId },
      reads: { none: { userId: ctx.userId } },
    },
  });

  const mapProject = (p: (typeof projects)[number]) => ({
    id: p.id.toString(),
    title: p.title,
    serviceName: p.service.name,
    status: p.status,
    startDate: p.startDate?.toISOString() ?? null,
    dueDate: p.dueDate?.toISOString() ?? null,
    progress: projectProgress(p.steps),
    pendingInvoices: p.invoices.length,
    deliverables: p.files.map((f) => ({
      id: f.id.toString(),
      publicId: f.publicId,
      name: f.originalName,
      mime: f.mimeType,
      sizeBytes: Number(f.sizeBytes),
      version: f.version,
      approval: f.approval,
      createdAt: f.createdAt.toISOString(),
    })),
    steps: p.steps.map((s) => ({
      label: s.label,
      position: s.position,
      reachedAt: s.reachedAt?.toISOString() ?? null,
    })),
  });

  return {
    featured: featured ? mapProject(featured) : null,
    others: others.map(mapProject),
    unreadCount,
    teamMessages: teamMessages.map((m) => ({
      projectId: m.projectId.toString(),
      projectTitle: m.project.title,
      senderName: m.sender.fullName,
      excerpt: m.body.length > 140 ? m.body.slice(0, 140) + "…" : m.body,
      createdAt: m.createdAt.toISOString(),
      unread: m.reads.length === 0,
    })),
  };
}

export type ClientHomeData = Awaited<ReturnType<typeof clientHome>>;
