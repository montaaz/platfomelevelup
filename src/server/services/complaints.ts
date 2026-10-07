import { prisma } from "@/lib/prisma";
import { mirrorNotificationEmails, notifyTeamByEmail } from "@/lib/mail";
import { assertAdmin, clientScope, ForbiddenError, ValidationError, type Ctx } from "@/server/context";

/**
 * Réclamations clients — le circuit publié sur levelupia.agency/fr/reclamations :
 * le client dépose sa réclamation depuis son espace, l'équipe est avertie
 * aussitôt (tableau de bord + e-mail), répond par écrit et fait évoluer le
 * statut ; le client voit la réponse dans son espace et par e-mail.
 */

export const COMPLAINT_CATEGORIES = ["PAIEMENT", "PRESTATION", "DELAI", "FACTURE", "AUTRE"] as const;
export const COMPLAINT_STATUSES = ["NOUVELLE", "EN_COURS", "RESOLUE", "CLOTUREE"] as const;
type Category = (typeof COMPLAINT_CATEGORIES)[number];
type Status = (typeof COMPLAINT_STATUSES)[number];

export const COMPLAINT_CATEGORY_LABEL: Record<string, string> = {
  PAIEMENT: "Paiement",
  PRESTATION: "Prestation",
  DELAI: "Délai",
  FACTURE: "Facture",
  AUTRE: "Autre",
};
export const COMPLAINT_STATUS_LABEL: Record<string, string> = {
  NOUVELLE: "Nouvelle",
  EN_COURS: "En cours",
  RESOLUE: "Résolue",
  CLOTUREE: "Clôturée",
};

export type ComplaintRow = {
  id: string;
  clientId: string;
  clientCompany: string;
  contactName: string;
  projectId: string | null;
  projectTitle: string | null;
  category: string;
  subject: string;
  message: string;
  status: string;
  adminReply: string | null;
  repliedAt: string | null;
  createdAt: string;
};

type WithRelations = Awaited<ReturnType<typeof fetchAll>>[number];
function fetchAll(where: Record<string, unknown>) {
  return prisma.complaint.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { client: { select: { companyName: true, contactName: true } }, project: { select: { title: true } } },
  });
}
const toRow = (c: WithRelations): ComplaintRow => ({
  id: c.id.toString(),
  clientId: c.clientId.toString(),
  clientCompany: c.client.companyName,
  contactName: c.client.contactName,
  projectId: c.projectId?.toString() ?? null,
  projectTitle: c.project?.title ?? null,
  category: c.category,
  subject: c.subject,
  message: c.message,
  status: c.status,
  adminReply: c.adminReply,
  repliedAt: c.repliedAt?.toISOString() ?? null,
  createdAt: c.createdAt.toISOString(),
});

/** Réclamations du client connecté. */
export async function myComplaints(ctx: Ctx): Promise<ComplaintRow[]> {
  const clientId = clientScope(ctx);
  return (await fetchAll({ clientId })).map(toRow);
}

/** Toutes les réclamations, les ouvertes d'abord. */
export async function listComplaints(ctx: Ctx): Promise<ComplaintRow[]> {
  assertAdmin(ctx);
  const rows = (await fetchAll({})).map(toRow);
  const rank = (s: string) => (s === "NOUVELLE" ? 0 : s === "EN_COURS" ? 1 : 2);
  return rows.sort((a, b) => rank(a.status) - rank(b.status));
}

export async function openComplaintsCount(): Promise<number> {
  return prisma.complaint.count({ where: { status: { in: ["NOUVELLE", "EN_COURS"] } } });
}

export async function createComplaint(
  ctx: Ctx,
  input: { category: string; subject: string; message: string; projectId?: bigint | null },
) {
  const clientId = clientScope(ctx);
  const subject = input.subject.trim();
  const message = input.message.trim();
  if (!subject || subject.length > 200) throw new ValidationError("Merci d'indiquer l'objet de votre réclamation.");
  if (message.length < 10) throw new ValidationError("Décrivez votre réclamation en quelques phrases.");
  if (message.length > 6000) throw new ValidationError("Message trop long (6 000 caractères maximum).");
  const category: Category = COMPLAINT_CATEGORIES.includes(input.category as Category) ? (input.category as Category) : "AUTRE";

  // Le projet désigné doit appartenir au client : on ne rattache jamais une
  // réclamation au projet d'un autre.
  let projectId: bigint | null = null;
  if (input.projectId != null) {
    const project = await prisma.project.findFirst({
      where: { id: input.projectId, clientId, deletedAt: null },
      select: { id: true },
    });
    projectId = project?.id ?? null;
  }

  const complaint = await prisma.complaint.create({
    data: { clientId, createdByUserId: ctx.userId, projectId, category, subject, message },
    include: { client: { select: { companyName: true } } },
  });

  const admins = await prisma.user.findMany({ where: { role: "ADMIN", isActive: true }, select: { id: true } });
  if (admins.length > 0) {
    const title = `Réclamation — ${complaint.client.companyName}`;
    const body = `${COMPLAINT_CATEGORY_LABEL[category]} : ${subject}`;
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "DEMANDE_PROJET" as const,
        title,
        body,
        entityType: "complaint",
        entityId: complaint.id,
      })),
    });
    mirrorNotificationEmails(admins.map((a) => a.id), title, body);
  }
  notifyTeamByEmail(
    `Nouvelle réclamation — ${complaint.client.companyName}`,
    `${COMPLAINT_CATEGORY_LABEL[category]} · ${subject}\n\n${message}\n\nÀ accuser réception sous 2 jours ouvrés et à traiter sous 7 jours ouvrés (réclamation n° ${complaint.id}).`,
  );
  return { id: complaint.id.toString() };
}

/** L'équipe répond et/ou change le statut ; le client en est averti. */
export async function updateComplaint(
  ctx: Ctx,
  complaintId: bigint,
  input: { status?: string | null; reply?: string | null },
) {
  assertAdmin(ctx);
  const complaint = await prisma.complaint.findUnique({ where: { id: complaintId }, select: { id: true, clientId: true, subject: true, status: true } });
  if (!complaint) throw new ForbiddenError();

  const status: Status | undefined = input.status
    ? (COMPLAINT_STATUSES.includes(input.status as Status) ? (input.status as Status) : undefined)
    : undefined;
  if (input.status && !status) throw new ValidationError("Statut inconnu.");
  const reply = input.reply?.trim() || null;

  await prisma.complaint.update({
    where: { id: complaintId },
    data: {
      ...(status ? { status } : {}),
      ...(reply ? { adminReply: reply, repliedAt: new Date(), handledByUserId: ctx.userId } : {}),
      // Une réponse sans statut choisi fait au moins passer la réclamation « en cours ».
      ...(!status && reply && complaint.status === "NOUVELLE" ? { status: "EN_COURS" } : {}),
    },
  });

  const clientUsers = await prisma.user.findMany({
    where: { role: "CLIENT", clientId: complaint.clientId, isActive: true },
    select: { id: true },
  });
  if (clientUsers.length > 0 && (reply || status)) {
    const title = `Votre réclamation « ${complaint.subject} »`;
    const body = reply ?? `Statut : ${COMPLAINT_STATUS_LABEL[status!]}.`;
    await prisma.notification.createMany({
      data: clientUsers.map((u) => ({
        userId: u.id,
        type: "STATUT_PROJET" as const,
        title,
        body,
        entityType: "complaint",
        entityId: complaint.id,
      })),
    });
    mirrorNotificationEmails(clientUsers.map((u) => u.id), title, body);
  }
  return true;
}
