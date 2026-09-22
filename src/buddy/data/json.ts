import { assertAdmin, clientScope } from "@/server/context";
import { reviewInvoice, reviewOrder } from "./review";
import { inRange, invoiceStatus, orderStatus, projectStatus } from "./status";
import type {
  BuddyCtx, BuddyDataSource, DeliverableDTO, InvoiceDTO, OrderDTO, ProductDTO, ProfileDTO, ProjectDTO,
  QueryFilter, ReviewItemDTO, SummaryDTO, TaskDTO, TeamMessageDTO, ThreadDTO,
} from "./types";

/**
 * Adaptateur sur des données JSON locales.
 *
 * Même contrat et même cloisonnement que l'adaptateur Prisma, sur un jeu de
 * données figé : c'est ce que les tests exercent, et ce qui permet de faire
 * tourner le chatbot sans base. Les valeurs sont reprises telles quelles ;
 * une information absente reste absente et ressort dans `review`.
 */

export type Fixtures = {
  clients: { id: string; companyName: string; address: string | null; country: string | null }[];
  users: { id: string; role: "ADMIN" | "CLIENT"; clientId: string | null; fullName: string; email?: string }[];
  packs: { code: string; name: string; description: string | null; includes?: string[]; tagline?: string | null; price: number; isMonthly: boolean; position?: number }[];
  orders: {
    id: string; clientId: string; packCode: string; amount: number; status: string; createdAt: string;
    paidAt?: string | null; projectId: string | null; invoiceId: string | null; paymentMethod: string | null; paymentReference: string | null;
  }[];
  projects: {
    id: string; clientId: string; title: string; serviceName?: string; status: string; createdAt?: string;
    startDate?: string | null; dueDate?: string | null; deliveredAt?: string | null; steps: { label: string; reachedAt: string | null }[];
  }[];
  files: { id?: string; publicId?: string; projectId: string; originalName: string; mimeType?: string; version?: number; kind: string; approval: string | null; createdAt?: string }[];
  invoices: {
    id: string; number: string; clientId: string; projectId?: string | null; status: string; total: number;
    issueDate?: string; dueDate: string | null; paidAt?: string | null; lineCount: number;
    payments: { method: string; reference: string | null }[];
  }[];
  requests: { clientId: string; title: string; status: string }[];
  messages: { projectId: string; senderUserId: string; senderName: string; body: string; createdAt: string; readBy: string[] }[];
};

const UNPAID = new Set(["EN_ATTENTE", "EN_RETARD"]);
const LIMIT = 10;
const cap = <T,>(rows: T[], filter?: QueryFilter) => rows.slice(0, Math.min(filter?.limit ?? LIMIT, 50));
const progressOf = (steps: { reachedAt: string | null }[]) =>
  steps.length === 0 ? 0 : Math.round((steps.filter((s) => s.reachedAt).length / steps.length) * 100);

export function jsonDataSource(data: Fixtures, now: () => Date = () => new Date()): BuddyDataSource {
  const company = (clientId: string) => data.clients.find((c) => c.id === clientId)?.companyName ?? "";

  /** Identifiants de clients visibles : le sien, ou tous / ceux dont le nom correspond. */
  function visibleClients(ctx: BuddyCtx, filter?: QueryFilter): Set<string> {
    if (ctx.role === "CLIENT") return new Set([clientScope(ctx).toString()]);
    assertAdmin(ctx);
    const needle = filter?.company?.toLowerCase();
    return new Set(
      data.clients.filter((c) => !needle || c.companyName.toLowerCase().includes(needle)).map((c) => c.id),
    );
  }

  const orderDTO = (o: Fixtures["orders"][number]): OrderDTO => {
    const pack = data.packs.find((p) => p.code === o.packCode);
    return {
      id: o.id,
      clientCompany: company(o.clientId),
      packName: pack?.name ?? o.packCode,
      amount: o.amount,
      status: o.status,
      createdAt: o.createdAt,
      paidAt: o.paidAt ?? null,
      paymentMethod: o.paymentMethod,
      review: reviewOrder(
        {
          status: o.status,
          createdAt: new Date(o.createdAt),
          isMonthly: pack?.isMonthly ?? false,
          projectId: o.projectId,
          invoiceId: o.invoiceId,
          paymentMethod: o.paymentMethod,
          paymentReference: o.paymentReference,
        },
        now(),
      ),
    };
  };

  const invoiceDTO = (i: Fixtures["invoices"][number]): InvoiceDTO => ({
    number: i.number,
    clientCompany: company(i.clientId),
    projectTitle: data.projects.find((p) => p.id === i.projectId)?.title ?? null,
    status: i.status,
    total: i.total,
    issueDate: i.issueDate ?? i.dueDate ?? "",
    dueDate: i.dueDate,
    paidAt: i.paidAt ?? null,
    review: reviewInvoice(
      { status: i.status, dueDate: i.dueDate ? new Date(i.dueDate) : null, lineCount: i.lineCount, payments: i.payments },
      now(),
    ),
  });

  const projectDTO = (p: Fixtures["projects"][number]): ProjectDTO => ({
    id: p.id,
    title: p.title,
    clientCompany: company(p.clientId),
    serviceName: p.serviceName ?? null,
    status: p.status,
    progress: progressOf(p.steps),
    nextStep: p.steps.find((s) => !s.reachedAt)?.label ?? null,
    steps: p.steps,
    startDate: p.startDate ?? null,
    dueDate: p.dueDate ?? null,
    deliveredAt: p.deliveredAt ?? null,
  });

  return {
    async summary(ctx): Promise<SummaryDTO> {
      const ids = visibleClients(ctx);
      const invoices = data.invoices.filter((i) => ids.has(i.clientId));
      const unpaid = invoices.filter((i) => UNPAID.has(i.status));
      const pendingOrders = data.orders.filter((o) => ids.has(o.clientId) && o.status === "EN_ATTENTE_PAIEMENT").length;

      if (ctx.role === "CLIENT") {
        const projects = data.projects.filter((p) => ids.has(p.clientId) && p.status !== "CLOTURE");
        const unread = data.messages.filter(
          (m) => ids.has(data.projects.find((p) => p.id === m.projectId)?.clientId ?? "") &&
            m.senderUserId !== ctx.userId.toString() && !m.readBy.includes(ctx.userId.toString()),
        ).length;
        return {
          role: "CLIENT",
          activeProjects: projects.map((p) => ({
            title: p.title,
            status: p.status,
            nextStep: p.steps.find((s) => !s.reachedAt)?.label ?? null,
            progress: progressOf(p.steps),
          })),
          unpaidCount: unpaid.length,
          unpaidTotal: unpaid.reduce((s, i) => s + i.total, 0),
          unread,
          pendingOrders,
        };
      }
      return {
        role: "ADMIN",
        revenueMonth: invoices.filter((i) => i.status === "PAYEE").reduce((s, i) => s + i.total, 0),
        projectsInProgress: data.projects.filter((p) => ["EN_ATTENTE", "EN_COURS", "EN_REVISION"].includes(p.status)).length,
        unpaidCount: unpaid.length,
        unpaidTotal: unpaid.reduce((s, i) => s + i.total, 0),
        revisionRequests: data.projects.filter((p) => p.status === "EN_REVISION").length,
        pendingOrders,
        newRequests: data.requests.filter((r) => r.status === "NOUVELLE").length,
      };
    },

    async orders(ctx, filter): Promise<OrderDTO[]> {
      const ids = visibleClients(ctx, filter);
      const status = orderStatus(filter?.status);
      return cap(
        data.orders
          .filter((o) => ids.has(o.clientId))
          .filter((o) => !status || o.status === status)
          .filter((o) => inRange(o.createdAt, filter?.since, filter?.until))
          .map(orderDTO),
        filter,
      );
    },

    async products(): Promise<ProductDTO[]> {
      return data.packs.map((p, i) => ({
        ...p, includes: p.includes ?? [], tagline: p.tagline ?? null, position: p.position ?? i + 1,
      }));
    },

    async reviewItems(ctx, filter): Promise<ReviewItemDTO[]> {
      const ids = visibleClients(ctx, filter);
      const items: ReviewItemDTO[] = [];
      for (const i of data.invoices.filter((i) => ids.has(i.clientId))) {
        const dto = invoiceDTO(i);
        if (dto.review.length) items.push({ kind: "FACTURE", ref: dto.number, clientCompany: dto.clientCompany, reasons: dto.review });
      }
      for (const o of data.orders.filter((o) => ids.has(o.clientId))) {
        const dto = orderDTO(o);
        if (dto.review.length) items.push({ kind: "COMMANDE", ref: `${dto.packName} (#${dto.id})`, clientCompany: dto.clientCompany, reasons: dto.review });
      }
      return items;
    },

    async threads(ctx, filter): Promise<ThreadDTO[]> {
      const ids = visibleClients(ctx, filter);
      const me = ctx.userId.toString();
      const threads: ThreadDTO[] = [];
      for (const p of data.projects.filter((p) => ids.has(p.clientId))) {
        const msgs = data.messages.filter((m) => m.projectId === p.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        const last = msgs[0];
        if (!last) continue;
        threads.push({
          projectId: p.id,
          projectTitle: p.title,
          clientCompany: company(p.clientId),
          lastMessage: last.body,
          lastSenderName: last.senderName,
          unread: msgs.filter((m) => m.senderUserId !== me && !m.readBy.includes(me)).length,
          lastAt: last.createdAt,
        });
      }
      return threads
        .filter((t) => inRange(t.lastAt, filter?.since, filter?.until))
        .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
        .slice(0, filter?.limit ?? 5);
    },

    async tasks(ctx, filter): Promise<TaskDTO[]> {
      const ids = visibleClients(ctx, filter);
      const tasks: TaskDTO[] = [];
      const projects = data.projects.filter((p) => ids.has(p.clientId));

      if (ctx.role === "CLIENT") {
        const client = data.clients.find((c) => ids.has(c.id));
        const name = client?.companyName ?? "";
        for (const f of data.files.filter((f) => f.kind === "LIVRABLE" && f.approval === "EN_ATTENTE")) {
          const p = projects.find((p) => p.id === f.projectId);
          if (p) tasks.push({ label: `Livrable à approuver : ${f.originalName} (${p.title})`, clientCompany: name });
        }
        for (const i of data.invoices.filter((i) => ids.has(i.clientId) && UNPAID.has(i.status))) {
          tasks.push({ label: `Facture ${i.number} à régler (${i.total} DT)`, clientCompany: name });
        }
        for (const p of projects.filter((p) => p.status === "EN_REVISION")) {
          tasks.push({ label: `Projet « ${p.title} » attend votre validation`, clientCompany: name });
        }
        for (const o of data.orders.filter((o) => ids.has(o.clientId) && o.status === "EN_ATTENTE_PAIEMENT")) {
          tasks.push({ label: `Commande ${orderDTO(o).packName} en attente de paiement`, clientCompany: name });
        }
        if (client && !(client.address?.trim() && client.country?.trim())) {
          tasks.push({ label: "Compléter votre profil (adresse et pays)", clientCompany: name });
        }
        return tasks;
      }

      for (const r of data.requests.filter((r) => ids.has(r.clientId) && r.status === "NOUVELLE")) {
        tasks.push({ label: `Demande de projet à étudier : ${r.title}`, clientCompany: company(r.clientId) });
      }
      for (const o of data.orders.filter((o) => ids.has(o.clientId) && o.status === "EN_ATTENTE_PAIEMENT")) {
        tasks.push({ label: `Commande à confirmer : ${orderDTO(o).packName} (${o.amount} DT)`, clientCompany: company(o.clientId) });
      }
      for (const p of projects.filter((p) => p.status === "EN_REVISION")) {
        tasks.push({ label: `Projet en révision : ${p.title}`, clientCompany: company(p.clientId) });
      }
      for (const i of data.invoices.filter((i) => ids.has(i.clientId) && i.status === "EN_RETARD")) {
        tasks.push({ label: `Facture en retard : ${i.number} (${i.total} DT)`, clientCompany: company(i.clientId) });
      }
      return tasks;
    },

    async invoices(ctx, filter): Promise<InvoiceDTO[]> {
      const ids = visibleClients(ctx, filter);
      const status = invoiceStatus(filter?.status);
      return cap(
        data.invoices
          .filter((i) => ids.has(i.clientId) && i.status !== "BROUILLON")
          .filter((i) => !status || i.status === status)
          .filter((i) => !filter?.reference || i.number.toLowerCase() === filter.reference.toLowerCase())
          .filter((i) => inRange(i.issueDate ?? i.dueDate, filter?.since, filter?.until))
          .sort((a, b) => (b.issueDate ?? "").localeCompare(a.issueDate ?? ""))
          .map(invoiceDTO),
        filter,
      );
    },

    async projects(ctx, filter): Promise<ProjectDTO[]> {
      const ids = visibleClients(ctx, filter);
      const status = projectStatus(filter?.status);
      const needle = filter?.name?.toLowerCase();
      return cap(
        data.projects
          .filter((p) => ids.has(p.clientId))
          .filter((p) => !status || p.status === status)
          .filter((p) => !needle || p.title.toLowerCase().includes(needle))
          .filter((p) => !filter?.projectId || p.id === filter.projectId)
          .filter((p) => inRange(p.createdAt ?? p.startDate, filter?.since, filter?.until))
          .map(projectDTO),
        filter,
      );
    },

    async deliverables(ctx, filter): Promise<DeliverableDTO[]> {
      const ids = visibleClients(ctx, filter);
      const projects = data.projects.filter((p) => ids.has(p.clientId) && (!filter?.projectId || p.id === filter.projectId));
      const out: DeliverableDTO[] = [];
      for (const f of data.files.filter((f) => f.kind === "LIVRABLE")) {
        const p = projects.find((p) => p.id === f.projectId);
        if (!p) continue;
        out.push({
          id: f.id ?? f.originalName,
          projectId: p.id,
          projectTitle: p.title,
          name: f.originalName,
          mime: f.mimeType ?? "application/octet-stream",
          version: f.version ?? 1,
          approval: f.approval,
          createdAt: f.createdAt ?? "",
          href: `/api/files/${f.publicId ?? "00000000-0000-0000-0000-000000000000"}`,
        });
      }
      return cap(out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)), filter);
    },

    async teamMessages(ctx, filter): Promise<TeamMessageDTO[]> {
      const ids = visibleClients(ctx, filter);
      const wanted = ctx.role === "CLIENT" ? "ADMIN" : "CLIENT";
      const out: TeamMessageDTO[] = [];
      for (const m of data.messages) {
        const p = data.projects.find((p) => p.id === m.projectId);
        const sender = data.users.find((u) => u.id === m.senderUserId);
        if (!p || !ids.has(p.clientId) || sender?.role !== wanted) continue;
        if (filter?.projectId && p.id !== filter.projectId) continue;
        out.push({ projectId: p.id, projectTitle: p.title, senderName: m.senderName, body: m.body, createdAt: m.createdAt });
      }
      return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, Math.min(filter?.limit ?? 3, 20));
    },

    async profile(ctx): Promise<ProfileDTO | null> {
      if (ctx.role !== "CLIENT") return null;
      const clientId = clientScope(ctx).toString();
      const client = data.clients.find((c) => c.id === clientId);
      const user = data.users.find((u) => u.id === ctx.userId.toString());
      if (!client || !user) return null;
      return {
        fullName: user.fullName,
        email: user.email ?? "",
        companyName: client.companyName,
        contactName: client.companyName,
        phone: null,
        address: client.address,
        city: null,
        country: client.country,
        complete: Boolean(client.address?.trim() && client.country?.trim()),
      };
    },
  };
}
