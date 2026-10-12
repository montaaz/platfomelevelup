import { prisma } from "@/lib/prisma";
import { formatDT, formatDateShort, PROJECT_STATUS_LABEL } from "@/lib/format";
import { configuredModel } from "@/buddy/ai/model";
import { compose } from "@/buddy/ai/assist";
import { guideChunks, productChunks, retrieve } from "@/buddy/ai/knowledge";
import { detectLanguage, type Lang } from "@/buddy/core/language";
import { prismaDataSource } from "@/buddy/data/prisma";

/**
 * L'assistant dans la messagerie des projets.
 *
 *  - Réponse automatique : quand un client écrit et que MESSAGING_AI=on,
 *    l'assistant répond aussitôt au nom de l'équipe, à partir des faits du
 *    projet (statut, étapes, livrables, échéance) et des connaissances du
 *    site — le même garde-fou que partout : rien d'inventé, sinon silence.
 *    La réponse est signée comme automatique ; l'équipe reprend ensuite.
 *  - Suggestion : l'admin demande un brouillon de réponse, qu'il relit et
 *    envoie lui-même.
 */

export function messagingAIEnabled(): boolean {
  return /^(1|on|true|yes)$/i.test(process.env.MESSAGING_AI ?? "") && configuredModel() !== null;
}

export const AUTO_REPLY_PREFIX = "🤖 Réponse automatique de l'assistant Level Up IA — l'équipe vous répond ensuite.\n\n";

async function projectFacts(projectId: bigint, lang: Lang): Promise<{ facts: string; packNames: string[] }> {
  const p = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      service: true,
      steps: { orderBy: { position: "asc" } },
      files: { where: { deletedAt: null, kind: "LIVRABLE" }, select: { originalName: true, createdAt: true } },
      invoices: { where: { status: { in: ["EN_ATTENTE", "EN_RETARD"] } }, select: { total: true } },
    },
  });
  const fr = lang === "fr";
  const reached = p.steps.filter((s) => s.reachedAt).map((s) => s.label);
  const next = p.steps.find((s) => !s.reachedAt)?.label ?? null;
  const unpaid = p.invoices.reduce((s, i) => s + Number(i.total), 0);
  const lines = [
    `${fr ? "Projet" : "Project"} : ${p.title} (${p.service.name}).`,
    `${fr ? "Statut" : "Status"} : ${PROJECT_STATUS_LABEL[p.status] ?? p.status}.`,
    reached.length ? `${fr ? "Étapes franchies" : "Steps reached"} : ${reached.join(", ")}.` : `${fr ? "Aucune étape franchie pour l'instant." : "No step reached yet."}`,
    next ? `${fr ? "Prochaine étape" : "Next step"} : ${next}.` : "",
    p.dueDate ? `${fr ? "Échéance prévue" : "Due date"} : ${formatDateShort(p.dueDate)}.` : `${fr ? "Échéance : pas encore planifiée." : "Due date: not scheduled yet."}`,
    p.files.length ? `${fr ? "Livrables disponibles" : "Deliverables available"} : ${p.files.length} (${p.files.slice(0, 3).map((f) => f.originalName).join(", ")}).` : `${fr ? "Aucun livrable déposé pour l'instant." : "No deliverable yet."}`,
    unpaid > 0 ? `${fr ? "Facture en attente" : "Unpaid invoice"} : ${formatDT(unpaid)}.` : `${fr ? "Aucune facture en attente." : "No unpaid invoice."}`,
    fr
      ? "Pour les retours sur un livrable, le client utilise le bouton « Demander une modification » ou « Approuver » dans Mes projets."
      : "For feedback on a deliverable, the client uses “Request a change” or “Approve” in My projects.",
  ].filter(Boolean);
  return { facts: lines.join("\n"), packNames: [p.title] };
}

/** Brouillon de réponse pour un message de client ; null si l'assistant ne sait pas. */
export async function draftReply(projectId: bigint, question: string, recentMessages: { fromClient: boolean; body: string }[]): Promise<string | null> {
  const model = configuredModel();
  if (!model) return null;
  const lang = detectLanguage(question, "fr");
  const { facts, packNames } = await projectFacts(projectId, lang);
  const products = await prismaDataSource.products();
  const owned = productChunks(products.filter((p) => packNames.some((n) => n.includes(p.name))), lang, formatDT);
  const guide = await retrieve(question, guideChunks(lang), 2, model);
  const context = recentMessages
    .slice(-6)
    .map((m) => `${m.fromClient ? "Client" : "Level Up IA"} : ${m.body.slice(0, 300)}`)
    .join("\n");
  const message = context
    ? `${lang === "fr" ? "Derniers échanges" : "Recent messages"} :\n${context}\n\n${lang === "fr" ? "Dernier message du client" : "Client's latest message"} : ${question}`
    : question;
  const r = await compose(model, { lang, message, facts, knowledge: [...owned, ...guide] });
  return r?.text ?? null;
}

/**
 * Réponse automatique à un message de client, en arrière-plan : ne bloque
 * jamais l'envoi du message, ne lève jamais.
 */
export function autoReplyLater(projectId: bigint, clientMessage: string): void {
  if (!messagingAIEnabled()) return;
  void (async () => {
    try {
      const recent = await prisma.message.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { sender: { select: { role: true } } },
      });
      // L'équipe vient de répondre : pas de réponse automatique par-dessus.
      const lastTeam = recent.find((m) => m.sender.role === "ADMIN");
      if (lastTeam && !lastTeam.body.startsWith(AUTO_REPLY_PREFIX) && Date.now() - lastTeam.createdAt.getTime() < 15 * 60_000) return;

      const history = recent.reverse().filter((m) => m.body !== clientMessage).map((m) => ({ fromClient: m.sender.role === "CLIENT", body: m.body.replace(AUTO_REPLY_PREFIX, "") }));
      const text = await draftReply(projectId, clientMessage, history);
      if (!text) return;

      const teamUser = await prisma.user.findFirst({ where: { role: "ADMIN", isActive: true }, orderBy: { id: "asc" }, select: { id: true } });
      if (!teamUser) return;
      await prisma.message.create({ data: { projectId, senderUserId: teamUser.id, body: AUTO_REPLY_PREFIX + text } });
    } catch (e) {
      console.warn("[messagerie-ia] réponse automatique impossible:", e instanceof Error ? e.message : e);
    }
  })();
}
